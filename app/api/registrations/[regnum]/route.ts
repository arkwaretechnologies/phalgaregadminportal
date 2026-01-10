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

    // Try to parse as number (batchnum), otherwise treat as regid (string)
    const batchnum = parseInt(params.regnum);
    const isNumeric = !isNaN(batchnum) && /^\d+$/.test(params.regnum);

    let registration;
    let regError;

    if (isNumeric) {
      // Use batchnum for lookup
      const { data, error } = await supabase
        .from('regh')
        .select('*')
        .eq('batchnum', batchnum)
        .maybeSingle();
      registration = data;
      regError = error;
    } else {
      // Use regid for lookup
      const regid = decodeURIComponent(params.regnum);
      const { data, error } = await supabase
        .from('regh')
        .select('*')
        .eq('regid', regid)
        .maybeSingle();
      registration = data;
      regError = error;
    }

    if (regError || !registration) {
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

    const registrationDetail: RegistrationDetail = {
      ...registration,
      regd: regd || undefined,
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


