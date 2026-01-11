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

    const contactId = parseInt(params.id);
    if (isNaN(contactId) || contactId <= 0) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { contact_no } = body as {
      contact_no?: string;
    };

    // Check if contact exists
    const { data: existing, error: checkError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .maybeSingle();

    if (checkError) {
      console.error('Contact check error:', checkError);
      return NextResponse.json({ error: 'Failed to check contact' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Validate contact_no
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
      .update({ contact_no: cleanedContactNo })
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      console.error('Contact update error:', error);
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
    }

    return NextResponse.json({ contact: data });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Contact PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['admin']);

    const contactId = parseInt(params.id);
    if (isNaN(contactId) || contactId <= 0) {
      return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
    }

    // Check if contact exists
    const { data: existing, error: checkError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .maybeSingle();

    if (checkError) {
      console.error('Contact check error:', checkError);
      return NextResponse.json({ error: 'Failed to check contact' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (deleteError) {
      console.error('Contact delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Contact deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Contact DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
