import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin']);

    const { searchParams } = new URL(request.url);
    const confcode = searchParams.get('confcode');

    let query = supabase
      .from('contacts')
      .select('*')
      .order('id', { ascending: true });

    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Contacts fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }

    return NextResponse.json({ contacts: data || [] });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Contacts GET error:', error);
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

    const { confcode, contact_no } = body as {
      confcode?: string;
      contact_no?: string;
    };

    if (!confcode || typeof confcode !== 'string' || confcode.trim() === '') {
      return NextResponse.json({ error: 'Conference code is required' }, { status: 400 });
    }

    if (!contact_no || typeof contact_no !== 'string' || contact_no.trim() === '') {
      return NextResponse.json({ error: 'Contact number is required' }, { status: 400 });
    }

    // Validate contact number is exactly 11 digits
    const cleanedContactNo = contact_no.trim().replace(/\D/g, '');
    if (cleanedContactNo.length !== 11) {
      return NextResponse.json({ error: 'Contact number must be exactly 11 digits' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        confcode: confcode.trim(),
        contact_no: cleanedContactNo,
      })
      .select()
      .single();

    if (error) {
      console.error('Contact insert error:', error);
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
    }

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Contact POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
