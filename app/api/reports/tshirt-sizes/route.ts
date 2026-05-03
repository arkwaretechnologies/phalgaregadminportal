import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { APPROVED_STATUS_VALUES } from '@/lib/registration-status';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Helper function to fetch all records without Supabase's default 1000 row limit
async function fetchAllRecords(
  table: string,
  selectFields: string,
  queryBuilder: (query: any) => any,
  pageSize: number = 1000
): Promise<{ data: any[]; error: any }> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(selectFields);
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

type TshirtSizeRow = {
  confcode: string | null;
  status: string | null;
  tshirtsize: string | null;
  participant_count: number | string; // supabase may return bigint as string depending on config
};

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const confcode = request.nextUrl.searchParams.get('confcode');
    const statusFilter = request.nextUrl.searchParams.get('status') || 'APPROVED'; // APPROVED | PENDING | ALL

    // Fetch all t-shirt size counts (no row limit)
    const { data, error } = await fetchAllRecords(
      'report_tshirt_size_counts',
      'confcode,status,tshirtsize,participant_count',
      (query) => {
        query = query
          .order('confcode', { ascending: true })
          .order('tshirtsize', { ascending: true, nullsFirst: false });
        if (confcode) {
          query = query.eq('confcode', confcode);
        }
        if (statusFilter !== 'ALL') {
          if (statusFilter === 'APPROVED') {
            query = query.in('status', [...APPROVED_STATUS_VALUES]);
          } else {
            query = query.eq('status', statusFilter);
          }
        }
        return query;
      }
    );

    if (error) {
      console.error('Error fetching t-shirt size counts:', error);
      return NextResponse.json({ error: 'Failed to fetch t-shirt size counts' }, { status: 500 });
    }

    const rows = (data || []) as TshirtSizeRow[];

    // Normalize counts + group by conference
    const byConference: Record<string, { confcode: string; total: number; sizes: Record<string, number> }> = {};

    for (const row of rows) {
      const cc = row.confcode || 'UNKNOWN';
      const size = row.tshirtsize || 'UNSPECIFIED';
      const countNum = typeof row.participant_count === 'string'
        ? Number(row.participant_count)
        : row.participant_count;
      const count = Number.isFinite(countNum) ? countNum : 0;

      if (!byConference[cc]) {
        byConference[cc] = { confcode: cc, total: 0, sizes: {} };
      }
      byConference[cc].sizes[size] = (byConference[cc].sizes[size] || 0) + count;
      byConference[cc].total += count;
    }

    const conferences = Object.values(byConference);

    return NextResponse.json({
      conferences,
      total_conferences: conferences.length,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching t-shirt size counts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

