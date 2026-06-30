import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { APPROVED_STATUS_VALUES } from '@/lib/registration-status';
import {
  buildReportCacheKey,
  storeAndRespondReport,
  tryCachedReportResponse,
} from '@/lib/redis';

export const dynamic = 'force-dynamic';

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

export type BatchSummaryRow = {
  batch_num: number;
  lgu: string;
  province: string;
  t_shirt: string;
  size_count: number;
};

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    const cacheKey = buildReportCacheKey('batch-summary', searchParams);
    const cachedResponse = await tryCachedReportResponse(cacheKey);
    if (cachedResponse) return cachedResponse;

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

    const batchesMap = new Map<number, any[]>();
    (approvedRegistrations || []).forEach((reg: any) => {
      if (reg.batchnum != null && typeof reg.batchnum === 'number') {
        if (!batchesMap.has(reg.batchnum)) {
          batchesMap.set(reg.batchnum, []);
        }
        batchesMap.get(reg.batchnum)!.push(reg);
      }
    });

    const summaryRows: BatchSummaryRow[] = [];

    for (const [batchnum, regs] of batchesMap) {
      const regids = regs.map((r: any) => r.regid).filter((id: any) => id && typeof id === 'string');
      const firstReg = regs[0];
      const lgu = firstReg?.lgu?.trim() || '';
      const province = firstReg?.province?.trim() || '';

      if (regids.length === 0) {
        summaryRows.push({
          batch_num: batchnum,
          lgu,
          province,
          t_shirt: '',
          size_count: 0,
        });
        continue;
      }

      const { data: regdRows, error: regdError } = await fetchAllRecords(
        'regd',
        (query) =>
          query
            .in('regid', regids)
            .order('regid', { ascending: true })
            .order('linenum', { ascending: true })
      );

      if (regdError || !regdRows) {
        summaryRows.push({
          batch_num: batchnum,
          lgu,
          province,
          t_shirt: '',
          size_count: 0,
        });
        continue;
      }

      const sizeCounts: Record<string, number> = {};
      for (const row of regdRows) {
        const size = (row.tshirtsize && String(row.tshirtsize).trim()) || 'UNSPECIFIED';
        sizeCounts[size] = (sizeCounts[size] || 0) + 1;
      }

      const sizes = Object.keys(sizeCounts).sort((a, b) => a.localeCompare(b));
      if (sizes.length === 0) {
        summaryRows.push({
          batch_num: batchnum,
          lgu,
          province,
          t_shirt: '',
          size_count: 0,
        });
      } else {
        for (const size of sizes) {
          summaryRows.push({
            batch_num: batchnum,
            lgu,
            province,
            t_shirt: size,
            size_count: sizeCounts[size],
          });
        }
      }
    }

    summaryRows.sort((a, b) => {
      if (a.batch_num !== b.batch_num) return a.batch_num - b.batch_num;
      return (a.t_shirt || '').localeCompare(b.t_shirt || '');
    });

    return storeAndRespondReport(cacheKey, {
      rows: summaryRows,
      total: summaryRows.length,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching batch summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
