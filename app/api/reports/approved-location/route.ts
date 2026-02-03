import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

type LocationRow = {
  confcode: string | null;
  province: string | null;
  lgu: string | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const confcode = request.nextUrl.searchParams.get('confcode');

    // Query approved registrations from regh table
    let query = supabase
      .from('regh')
      .select('confcode, province, lgu')
      .eq('status', 'APPROVED')
      .order('confcode', { ascending: true })
      .order('province', { ascending: true })
      .order('lgu', { ascending: true });

    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    const { data, error } = await query;

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
