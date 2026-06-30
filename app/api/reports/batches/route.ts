import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { APPROVED_STATUS_VALUES } from '@/lib/registration-status';
import {
  buildReportCacheKey,
  storeAndRespondReport,
  tryCachedReportResponse,
} from '@/lib/redis';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Helper function to fetch all records without Supabase's default 1000 row limit
async function fetchAllRecords(
  table: string,
  queryBuilder: (query: any) => any,
  pageSize: number = 1000
): Promise<{ data: any[]; error: any }> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select('*');
    query = queryBuilder(query);
    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      return { data: [], error };
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, error: null };
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    const cacheKey = buildReportCacheKey('batches', searchParams);
    const cachedResponse = await tryCachedReportResponse(cacheKey);
    if (cachedResponse) return cachedResponse;

    // Build query for approved registrations with batch numbers (no row limit)
    const { data: approvedRegistrations, error: regError } = await fetchAllRecords(
      'regh',
      (query) => {
        query = query
          .in('status', [...APPROVED_STATUS_VALUES])
          .not('batchnum', 'is', null)
          .order('batchnum', { ascending: true });
        if (confcode) {
          query = query.eq('confcode', confcode);
        }
        return query;
      }
    );

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

    // Fetch participants for each batch (by regid, not batchnum) - no row limit
    const batchesWithParticipants = await Promise.all(
      batches.map(async (batch) => {
        const regids = batch.registrations.map((r: any) => r.regid).filter((id: any) => id && typeof id === 'string');
        
        let participants: any[] = [];
        if (regids.length > 0) {
          const { data: regdRows, error: regdError } = await fetchAllRecords(
            'regd',
            (query) => {
              return query
                .in('regid', regids)
                .order('regid', { ascending: true })
                .order('linenum', { ascending: true });
            }
          );

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

    return storeAndRespondReport(cacheKey, {
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
