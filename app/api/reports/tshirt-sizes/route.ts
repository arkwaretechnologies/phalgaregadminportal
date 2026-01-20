import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

type TshirtSizeRow = {
  confcode: string | null;
  tshirtsize: string | null;
  participant_count: number | string; // supabase may return bigint as string depending on config
};

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const confcode = request.nextUrl.searchParams.get('confcode');

    let query = supabase
      .from('report_tshirt_size_counts')
      .select('confcode,tshirtsize,participant_count')
      .order('confcode', { ascending: true })
      .order('tshirtsize', { ascending: true, nullsFirst: false });

    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    const { data, error } = await query;

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

