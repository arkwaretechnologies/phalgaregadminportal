import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import { RegistrationDetail } from '@/types';
import { attachConferenceIsAnc } from '@/lib/attach-conference-is-anc';

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const { data: regById, error: errorById } = await supabaseServer
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
        const { data: regByBatch, error: errorByBatch } = await supabaseServer
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
      ? await supabaseServer
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
      const { error: upsertError } = await supabaseServer
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

    const withConference = await attachConferenceIsAnc(registrationDetail);

    return NextResponse.json({ registration: withConference });
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

// PATCH - Update registration header fields (contact person, email, contactnum, remarks)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  try {
    // Check authentication and role - admin and reviewer can update
    await requireAuth(['admin', 'reviewer']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { email, contactnum, remarks, contactperson } = body as {
      email?: string;
      contactnum?: string;
      remarks?: string | null;
      contactperson?: string | null;
    };

    // Validate at least one field is being updated
    if (
      email === undefined &&
      contactnum === undefined &&
      remarks === undefined &&
      contactperson === undefined
    ) {
      return NextResponse.json(
        {
          error:
            'At least one field (email, contactnum, remarks, or contactperson) must be provided',
        },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email !== undefined && email !== null && email.trim() !== '') {
      if (!EMAIL_REGEX.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    // Validate phone number if provided (must be 11 digits)
    if (contactnum !== undefined && contactnum !== null && contactnum.trim() !== '') {
      const digitsOnly = contactnum.trim().replace(/\D/g, '');
      if (digitsOnly.length !== 11) {
        return NextResponse.json(
          { error: 'Contact number must be exactly 11 digits' },
          { status: 400 }
        );
      }
    }

    // Find the registration by regid
    const decodedRegnum = decodeURIComponent(params.regnum);

    const { data: existingReg, error: findError } = await supabaseServer
      .from('regh')
      .select('regid')
      .eq('regid', decodedRegnum)
      .maybeSingle();

    if (findError || !existingReg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, string | null> = {};
    if (email !== undefined) {
      updateData.email = email?.trim() || null;
    }
    if (contactnum !== undefined) {
      // Store only digits for consistency
      updateData.contactnum = contactnum?.trim().replace(/\D/g, '') || null;
    }
    if (remarks !== undefined) {
      const trimmed = remarks == null ? '' : String(remarks).trim();
      updateData.remarks = trimmed === '' ? null : trimmed;
    }
    if (contactperson !== undefined) {
      const trimmed =
        contactperson == null ? '' : String(contactperson).trim().toUpperCase();
      updateData.contactperson = trimmed === '' ? null : trimmed;
    }

    // Update the registration
    const { data: updatedReg, error: updateError } = await supabaseServer
      .from('regh')
      .update(updateData)
      .eq('regid', decodedRegnum)
      .select('regid, email, contactnum, remarks, contactperson')
      .single();

    if (updateError) {
      console.error('Registration update error:', updateError);
      return NextResponse.json({ error: 'Failed to update registration' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Registration updated successfully',
      registration: updatedReg,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Registration PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}