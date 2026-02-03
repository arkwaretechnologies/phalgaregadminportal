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

    // First, find the registration to get the regid
    // Try both regid and batchnum lookups since regnum can be either
    let registration = null;

    // First, try to find by regid
    const { data: regById, error: errorById } = await supabase
      .from('regh')
      .select('regid')
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
          .select('regid')
          .eq('batchnum', batchnum)
          .maybeSingle();

        if (!errorByBatch && regByBatch) {
          registration = regByBatch;
        }
      }
    }

    if (!registration || !registration.regid) {
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
