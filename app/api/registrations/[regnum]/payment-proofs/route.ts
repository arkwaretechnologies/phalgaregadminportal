import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  try {
    await requireAuth(['admin', 'reviewer']);

    // Try both regid and batchnum lookups since regid can be numeric
    const decodedRegnum = decodeURIComponent(params.regnum);
    let regid: string | null = null;

    // First, try to find by regid (this works for both pending and approved)
    const { data: regById, error: errorById } = await supabase
      .from('regh')
      .select('regid')
      .eq('regid', decodedRegnum)
      .maybeSingle();

    if (!errorById && regById?.regid) {
      regid = regById.regid;
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
        
        if (!errorByBatch && regByBatch?.regid) {
          regid = regByBatch.regid;
        }
      }
    }

    if (!regid) {
      console.error('Registration ID not found for payment proofs:', {
        regnum: params.regnum,
        decodedRegnum,
        triedRegid: true,
        triedBatchnum: /^\d+$/.test(params.regnum),
      });
      return NextResponse.json({ error: 'Registration ID not found' }, { status: 404 });
    }

    const { data: paymentProofs, error } = await supabase
      .from('regdep')
      .select('payment_proof_url, uploaded_at')
      .eq('regid', regid)
      .order('uploaded_at', { ascending: true });

    if (error) {
      console.error('Database error fetching payment proofs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment proofs' },
        { status: 500 }
      );
    }

    const formattedProofs = (paymentProofs || []).map(proof => ({
      url: proof.payment_proof_url,
      uploaded_at: proof.uploaded_at,
    }));

    return NextResponse.json({ paymentProofs: formattedProofs });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Payment proofs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
