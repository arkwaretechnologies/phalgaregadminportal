import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

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

type LocationRow = {
  confcode: string | null;
  province: string | null;
  lgu: string | null;
};

type ParticipantRow = {
  confcode: string | null;
  province: string | null;
  lgu: string | null;
  regid: string | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const confcode = request.nextUrl.searchParams.get('confcode');
    const countBy = request.nextUrl.searchParams.get('countBy') || 'batch'; // 'batch' or 'participant'

    if (countBy === 'participant') {
      // Count participants from regd table (only for approved registrations)
      // First get all approved registration regids for the conference (no row limit)
      const { data: approvedRegs, error: reghError } = await fetchAllRecords(
        'regh',
        'regid, confcode',
        (query) => {
          query = query.eq('status', 'APPROVED').not('regid', 'is', null);
          if (confcode) {
            query = query.eq('confcode', confcode);
          }
          return query;
        }
      );

      if (reghError) {
        console.error('Error fetching approved registrations:', reghError);
        return NextResponse.json({ error: 'Failed to fetch approved registrations' }, { status: 500 });
      }

      if (!approvedRegs || approvedRegs.length === 0) {
        return NextResponse.json({
          provinceData: [],
          lguData: [],
          totalApproved: 0,
          totalProvinces: 0,
          totalLgus: 0,
          countBy: 'participant',
        });
      }

      const regids = approvedRegs.map(r => r.regid).filter(Boolean) as string[];

      // Query participants from regd table for approved registrations (no row limit)
      const { data: participants, error: regdError } = await fetchAllRecords(
        'regd',
        'confcode, province, lgu, regid',
        (query) => {
          query = query
            .in('regid', regids)
            .order('province', { ascending: true })
            .order('lgu', { ascending: true });
          if (confcode) {
            query = query.eq('confcode', confcode);
          }
          return query;
        }
      );

      if (regdError) {
        console.error('Error fetching participants:', regdError);
        return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
      }

      const rows = (participants || []) as ParticipantRow[];

      // Group by province and lgu
      const byProvince: Record<string, number> = {};
      const byLgu: Record<string, { province: string; lgu: string; count: number }> = {};

      for (const row of rows) {
        const province = row.province || 'UNSPECIFIED';
        const lgu = row.lgu || 'UNSPECIFIED';

        // Count by province
        byProvince[province] = (byProvince[province] || 0) + 1;

        // Count by LGU (with province for context)
        const lguKey = `${province}|${lgu}`;
        if (!byLgu[lguKey]) {
          byLgu[lguKey] = { province, lgu, count: 0 };
        }
        byLgu[lguKey].count += 1;
      }

      // Convert to arrays and sort
      const provinceData = Object.entries(byProvince)
        .map(([province, count]) => ({ province, count }))
        .sort((a, b) => a.province.localeCompare(b.province));

      const lguData = Object.values(byLgu)
        .sort((a, b) => {
          const provinceCompare = a.province.localeCompare(b.province);
          if (provinceCompare !== 0) return provinceCompare;
          return a.lgu.localeCompare(b.lgu);
        });

      const totalApproved = rows.length;

      return NextResponse.json({
        provinceData,
        lguData,
        totalApproved,
        totalProvinces: provinceData.length,
        totalLgus: lguData.length,
        countBy: 'participant',
      });
    }

    // Default: Count by batch (approved registrations from regh table) - no row limit
    const { data, error } = await fetchAllRecords(
      'regh',
      'confcode, province, lgu',
      (query) => {
        query = query
          .eq('status', 'APPROVED')
          .order('confcode', { ascending: true })
          .order('province', { ascending: true })
          .order('lgu', { ascending: true });
        if (confcode) {
          query = query.eq('confcode', confcode);
        }
        return query;
      }
    );

    if (error) {
      console.error('Error fetching approved location data:', error);
      return NextResponse.json({ error: 'Failed to fetch approved location data' }, { status: 500 });
    }

    const rows = (data || []) as LocationRow[];

    // Group by province and lgu
    const byProvince: Record<string, number> = {};
    const byLgu: Record<string, { province: string; lgu: string; count: number }> = {};

    for (const row of rows) {
      const province = row.province || 'UNSPECIFIED';
      const lgu = row.lgu || 'UNSPECIFIED';

      // Count by province
      byProvince[province] = (byProvince[province] || 0) + 1;

      // Count by LGU (with province for context)
      const lguKey = `${province}|${lgu}`;
      if (!byLgu[lguKey]) {
        byLgu[lguKey] = { province, lgu, count: 0 };
      }
      byLgu[lguKey].count += 1;
    }

    // Convert to arrays and sort
    const provinceData = Object.entries(byProvince)
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => a.province.localeCompare(b.province));

    const lguData = Object.values(byLgu)
      .sort((a, b) => {
        const provinceCompare = a.province.localeCompare(b.province);
        if (provinceCompare !== 0) return provinceCompare;
        return a.lgu.localeCompare(b.lgu);
      });

    const totalApproved = rows.length;

    return NextResponse.json({
      provinceData,
      lguData,
      totalApproved,
      totalProvinces: provinceData.length,
      totalLgus: lguData.length,
      countBy: 'batch',
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching approved location data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
