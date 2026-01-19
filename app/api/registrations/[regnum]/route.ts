import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { RegistrationDetail } from '@/types';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    // Try both regid and batchnum lookups since regid can be numeric
    // First try as regid (works for all registrations, including pending ones)
    const decodedRegnum = decodeURIComponent(params.regnum);
    let registration = null;
    let regError = null;

    // First, try to find by regid (this works for both pending and approved)
    const { data: regById, error: errorById } = await supabase
      .from('regh')
      .select('*, upload_notification(proof_uploaded_at, last_viewed_at)')
      .eq('regid', decodedRegnum)
      .maybeSingle();

    if (!errorById && regById) {
      registration = regById;
    } else {
      // If not found by regid and the param looks numeric, try batchnum
      const batchnum = parseInt(params.regnum);
      const isNumeric = !isNaN(batchnum) && /^\d+$/.test(params.regnum);
      
      if (isNumeric) {
        const { data: regByBatch, error: errorByBatch } = await supabase
          .from('regh')
          .select('*, upload_notification(proof_uploaded_at, last_viewed_at)')
          .eq('batchnum', batchnum)
          .maybeSingle();
        
        if (!errorByBatch && regByBatch) {
          registration = regByBatch;
        } else {
          regError = errorByBatch;
        }
      } else {
        regError = errorById;
      }
    }

    if (regError || !registration) {
      console.error('Registration not found:', {
        regnum: params.regnum,
        decodedRegnum,
        error: regError,
        triedRegid: true,
        triedBatchnum: /^\d+$/.test(params.regnum),
      });
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Fetch registration details (from regd table if exists)
    // regd is linked to regh by regid, not batchnum (batchnum is only generated when approved)
    const { data: regd, error: regdError } = registration.regid
      ? await supabase
          .from('regd')
          .select('*')
          .eq('regid', registration.regid)
          .order('linenum', { ascending: true })
      : { data: [], error: null };

    // Flatten the nested upload_notification structure
    const notification = Array.isArray(registration.upload_notification)
      ? registration.upload_notification[0]
      : registration.upload_notification;

    // Update last_viewed_at timestamp when registration is viewed.
    // IMPORTANT: do this BEFORE responding so the client doesn't overwrite optimistic UI with stale values.
    let viewedAtIso: string | null = null;
    if (registration.regid) {
      viewedAtIso = new Date().toISOString();
      const { error: upsertError } = await supabase
        .from('upload_notification')
        .upsert(
          {
            regid: registration.regid,
            last_viewed_at: viewedAtIso,
            updated_at: viewedAtIso,
          },
          { onConflict: 'regid' }
        );

      if (upsertError) {
        console.error('Error updating upload_notification.last_viewed_at:', upsertError);
        // If this fails, fall back to whatever was fetched via the join
        viewedAtIso = null;
      }
    }

    const registrationDetail: RegistrationDetail = {
      ...registration,
      regd: regd || undefined,
      proof_uploaded_at: notification?.proof_uploaded_at || null,
      last_viewed_at: viewedAtIso || notification?.last_viewed_at || null,
      // Remove the nested upload_notification object
      upload_notification: undefined,
    };

    return NextResponse.json({ registration: registrationDetail });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Registration detail fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


