import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { regnum: string; linenum: string } }
) {
  try {
    // Check authentication - allow admin and reviewer
    await requireAuth(['admin', 'reviewer']);

    const decodedRegnum = decodeURIComponent(params.regnum);
    const linenum = parseInt(params.linenum);

    if (isNaN(linenum)) {
      return NextResponse.json(
        { error: 'Invalid line number' },
        { status: 400 }
      );
    }

    const registration = await getRegistrationByRegnum(decodedRegnum);
    if (!registration?.regid) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Delete the participant from regd table
    const { error: deleteError, count } = await supabase
      .from('regd')
      .delete()
      .eq('regid', registration.regid)
      .eq('linenum', linenum);

    if (deleteError) {
      console.error('Error deleting participant:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete participant' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Participant deleted successfully',
      regid: registration.regid,
      linenum: linenum
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Participant deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getRegistrationByRegnum(decodedRegnum: string) {
  const { data: regById, error: errorById } = await supabase
    .from('regh')
    .select('regid')
    .eq('regid', decodedRegnum)
    .maybeSingle();

  if (!errorById && regById) return regById;

  const batchnum = parseInt(decodedRegnum);
  if (!isNaN(batchnum) && /^\d+$/.test(decodedRegnum)) {
    const { data: regByBatch, error: errorByBatch } = await supabase
      .from('regh')
      .select('regid')
      .eq('batchnum', batchnum)
      .maybeSingle();
    if (!errorByBatch && regByBatch) return regByBatch;
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { regnum: string; linenum: string } }
) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const decodedRegnum = decodeURIComponent(params.regnum);
    const linenum = parseInt(params.linenum);

    if (isNaN(linenum)) {
      return NextResponse.json(
        { error: 'Invalid line number' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { tshirtsize } = body as { tshirtsize?: string | null };
    const value = tshirtsize === undefined
      ? undefined
      : (tshirtsize === null || tshirtsize === '' ? null : String(tshirtsize).trim());

    if (value === undefined) {
      return NextResponse.json(
        { error: 'tshirtsize is required' },
        { status: 400 }
      );
    }

    const registration = await getRegistrationByRegnum(decodedRegnum);
    if (!registration?.regid) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from('regd')
      .update({ tshirtsize: value })
      .eq('regid', registration.regid)
      .eq('linenum', linenum);

    if (updateError) {
      console.error('Error updating participant t-shirt size:', updateError);
      return NextResponse.json(
        { error: 'Failed to update t-shirt size' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'T-shirt size updated successfully',
      regid: registration.regid,
      linenum,
      tshirtsize: value,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Participant PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
