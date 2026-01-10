import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    // Build query for approved registrations with batch numbers
    let query = supabase
      .from('regh')
      .select('*')
      .eq('status', 'APPROVED')
      .not('batchnum', 'is', null)
      .order('batchnum', { ascending: true });

    // Filter by conference code if provided
    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    const { data: approvedRegistrations, error: regError } = await query;

    if (regError) {
      console.error('Error fetching approved registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch approved registrations' },
        { status: 500 }
      );
    }

    // Group registrations by batch number
    const batchesMap = new Map<number, any[]>();
    
    (approvedRegistrations || []).forEach((reg: any) => {
      if (reg.batchnum && typeof reg.batchnum === 'number') {
        if (!batchesMap.has(reg.batchnum)) {
          batchesMap.set(reg.batchnum, []);
        }
        batchesMap.get(reg.batchnum)!.push(reg);
      }
    });

    // Get participants for each batch
    const batches = Array.from(batchesMap.keys()).map((batchnum) => {
      const registrations = batchesMap.get(batchnum) || [];
      return {
        batchnum,
        confcode: registrations[0]?.confcode || null,
        registrations,
        registration_count: registrations.length,
      };
    });

    // Fetch participants for each batch (by regid, not batchnum)
    const batchesWithParticipants = await Promise.all(
      batches.map(async (batch) => {
        const regids = batch.registrations.map((r: any) => r.regid).filter((id: any) => id && typeof id === 'string');
        
        let participants: any[] = [];
        if (regids.length > 0) {
          const { data: regdRows, error: regdError } = await supabase
            .from('regd')
            .select('*')
            .in('regid', regids)
            .order('regid', { ascending: true })
            .order('linenum', { ascending: true });

          if (!regdError && regdRows) {
            participants = regdRows;
          }
        }

        return {
          ...batch,
          participants,
          participant_count: participants.length,
        };
      })
    );

    return NextResponse.json({
      batches: batchesWithParticipants,
      total: batchesWithParticipants.length,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching batches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
