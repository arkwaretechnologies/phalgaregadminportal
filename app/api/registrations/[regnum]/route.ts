import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { RegistrationDetail } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const regnum = parseInt(params.regnum);

    if (isNaN(regnum)) {
      return NextResponse.json(
        { error: 'Invalid registration number' },
        { status: 400 }
      );
    }

    // Fetch registration header
    const { data: registration, error: regError } = await supabase
      .from('regh')
      .select('*')
      .eq('regnum', regnum)
      .single();

    if (regError || !registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Fetch registration details (from regd table if exists)
    const { data: regd, error: regdError } = await supabase
      .from('regd')
      .select('*')
      .eq('regnum', regnum)
      .order('linenum', { ascending: true });

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


