import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import {
  buildReportCacheKey,
  storeAndRespondReport,
  tryCachedReportResponse,
} from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function fetchAllRecords(
  client: SupabaseClient,
  table: string,
  queryBuilder: (query: any) => any,
  pageSize: number = 1000
): Promise<{ data: any[]; error: any }> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = client.from(table).select('*');
    query = queryBuilder(query);
    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;
    if (error) return { data: [], error };

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
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcodeRaw = searchParams.get('confcode');
    const confcode = confcodeRaw ? String(confcodeRaw).trim() : '';

    if (!confcode) {
      return NextResponse.json({ error: 'confcode is required' }, { status: 400 });
    }

    const { data: conf, error: confErr } = await supabaseServer
      .from('conference')
      .select('confcode, is_anc, name')
      .eq('confcode', confcode)
      .maybeSingle();

    if (confErr) {
      return NextResponse.json({ error: 'Failed to fetch conference' }, { status: 500 });
    }
    if (!conf) {
      return NextResponse.json({ error: 'Conference not found' }, { status: 404 });
    }

    const isAnc = String(conf.is_anc ?? '').toUpperCase() === 'Y';
    if (!isAnc) {
      return NextResponse.json(
        { error: 'This report is only available for ANC conferences (is_anc = Y).' },
        { status: 400 }
      );
    }

    const cacheKey = buildReportCacheKey('missing-prc', searchParams);
    const cachedResponse = await tryCachedReportResponse(cacheKey);
    if (cachedResponse) return cachedResponse;

    // PostgREST supports OR filters; include empty string and null.
    const { data: rows, error } = await fetchAllRecords(
      supabaseServer,
      'regd',
      (query) =>
        query
          .eq('confcode', confcode)
          .or('prcnum.is.null,prcnum.eq.')
          .order('regid', { ascending: true })
          .order('linenum', { ascending: true }),
      1000
    );

    if (error) {
      console.error('Missing PRC report error:', error);
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
    }

    // Extra safety: treat whitespace-only PRC as missing.
    const participants = (rows || []).filter((r: any) => {
      const v = r?.prcnum;
      if (v === null || v === undefined) return true;
      return String(v).trim() === '';
    });

    return storeAndRespondReport(cacheKey, {
      conference: { confcode: conf.confcode, name: conf.name ?? null, is_anc: conf.is_anc ?? null },
      participants,
      total: participants.length,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Missing PRC report route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

