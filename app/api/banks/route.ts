import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    let query = supabase
      .from('banks')
      .select('*')
      .order('id', { ascending: true });

    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Banks fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch banks' }, { status: 500 });
    }

    return NextResponse.json({ banks: data || [] });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Banks GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(['admin']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { confcode, bank_name, acct_no, payee } = body as {
      confcode?: string;
      bank_name?: string;
      acct_no?: string;
      payee?: string;
    };

    if (!confcode || typeof confcode !== 'string' || confcode.trim() === '') {
      return NextResponse.json({ error: 'Conference code is required' }, { status: 400 });
    }

    if (!bank_name || typeof bank_name !== 'string' || bank_name.trim() === '') {
      return NextResponse.json({ error: 'Bank name is required' }, { status: 400 });
    }

    if (!acct_no || typeof acct_no !== 'string' || acct_no.trim() === '') {
      return NextResponse.json({ error: 'Account number is required' }, { status: 400 });
    }

    if (!payee || typeof payee !== 'string' || payee.trim() === '') {
      return NextResponse.json({ error: 'Payee is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('banks')
      .insert({
        confcode: confcode.trim(),
        bank_name: bank_name.trim(),
        acct_no: acct_no.trim(),
        payee: payee.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Bank insert error:', error);
      return NextResponse.json({ error: 'Failed to create bank' }, { status: 500 });
    }

    return NextResponse.json({ bank: data }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Bank POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
