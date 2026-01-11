import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['admin']);

    const bankId = parseInt(params.id);
    if (isNaN(bankId) || bankId <= 0) {
      return NextResponse.json({ error: 'Invalid bank ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { bank_name, acct_no, payee } = body as {
      bank_name?: string;
      acct_no?: string;
      payee?: string;
    };

    // Check if bank exists
    const { data: existing, error: checkError } = await supabase
      .from('banks')
      .select('id')
      .eq('id', bankId)
      .maybeSingle();

    if (checkError) {
      console.error('Bank check error:', checkError);
      return NextResponse.json({ error: 'Failed to check bank' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    }

    // Build update object
    const updateData: any = {};
    if (bank_name !== undefined) {
      if (typeof bank_name !== 'string' || bank_name.trim() === '') {
        return NextResponse.json({ error: 'Bank name is required' }, { status: 400 });
      }
      updateData.bank_name = bank_name.trim();
    }
    if (acct_no !== undefined) {
      if (typeof acct_no !== 'string' || acct_no.trim() === '') {
        return NextResponse.json({ error: 'Account number is required' }, { status: 400 });
      }
      updateData.acct_no = acct_no.trim();
    }
    if (payee !== undefined) {
      if (typeof payee !== 'string' || payee.trim() === '') {
        return NextResponse.json({ error: 'Payee is required' }, { status: 400 });
      }
      updateData.payee = payee.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('banks')
      .update(updateData)
      .eq('id', bankId)
      .select()
      .single();

    if (error) {
      console.error('Bank update error:', error);
      return NextResponse.json({ error: 'Failed to update bank' }, { status: 500 });
    }

    return NextResponse.json({ bank: data });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Bank PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['admin']);

    const bankId = parseInt(params.id);
    if (isNaN(bankId) || bankId <= 0) {
      return NextResponse.json({ error: 'Invalid bank ID' }, { status: 400 });
    }

    // Check if bank exists
    const { data: existing, error: checkError } = await supabase
      .from('banks')
      .select('id')
      .eq('id', bankId)
      .maybeSingle();

    if (checkError) {
      console.error('Bank check error:', checkError);
      return NextResponse.json({ error: 'Failed to check bank' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('banks')
      .delete()
      .eq('id', bankId);

    if (deleteError) {
      console.error('Bank delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete bank' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Bank deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Bank DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
