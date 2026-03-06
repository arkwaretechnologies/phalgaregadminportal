import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

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

function normalize(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).trim();
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');
    const statusFilter = searchParams.get('status') || 'ALL'; // PENDING | APPROVED | ALL

    if (!confcode || confcode.trim() === '') {
      return NextResponse.json(
        { error: 'confcode query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch regh for this conference (optionally filter by status)
    const { data: registrations, error: regError } = await fetchAllRecords(
      'regh',
      (query) => {
        query = query.eq('confcode', confcode.trim()).order('regdate', { ascending: false });
        if (statusFilter === 'PENDING') {
          query = query.eq('status', 'PENDING');
        } else if (statusFilter === 'APPROVED') {
          query = query.eq('status', 'APPROVED');
        }
        return query;
      }
    );

    if (regError) {
      console.error('Error fetching registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch registrations' },
        { status: 500 }
      );
    }

    const regids = (registrations || []).map((r: any) => r?.regid).filter((id: any) => id);
    if (regids.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    // Fetch all regd rows for these registrations
    const { data: regdRows, error: regdError } = await fetchAllRecords(
      'regd',
      (query) =>
        query
          .in('regid', regids)
          .eq('confcode', confcode.trim())
          .order('regid', { ascending: true })
          .order('linenum', { ascending: true })
    );

    if (regdError) {
      console.error('Error fetching participants:', regdError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    const allParticipants = regdRows || [];

    // Attach registration summary to each participant
    const participantsWithReg = allParticipants.map((p: any) => {
      const reg = (registrations || []).find((r: any) => r.regid === p.regid);
      return {
        ...p,
        registration: reg
          ? {
              regid: reg.regid,
              batchnum: reg.batchnum,
              confcode: reg.confcode,
              regdate: reg.regdate,
              status: reg.status,
            }
          : null,
      };
    });

    // Group by (confcode, lastname, firstname, province, lgu) so we only show duplicates with same LGU and Province
    const keyToParticipants: Record<string, typeof participantsWithReg> = {};
    for (const p of participantsWithReg) {
      const c = normalize(p.confcode);
      const last = normalize(p.lastname);
      const first = normalize(p.firstname);
      const prov = normalize(p.province);
      const lgu = normalize(p.lgu);
      const key = `${c}\t${last}\t${first}\t${prov}\t${lgu}`;
      if (!keyToParticipants[key]) keyToParticipants[key] = [];
      keyToParticipants[key].push(p);
    }

    // Keep only groups with count > 1 and build response with original fields
    const groups: Array<{
      confcode: string | null;
      lastname: string | null;
      firstname: string | null;
      suffix: string | null;
      province: string | null;
      lgu: string | null;
      count: number;
      participants: any[];
    }> = [];

    for (const key of Object.keys(keyToParticipants)) {
      const list = keyToParticipants[key];
      if (list.length <= 1) continue;
      const first = list[0];
      groups.push({
        confcode: first.confcode ?? null,
        lastname: first.lastname ?? null,
        firstname: first.firstname ?? null,
        suffix: first.suffix ?? null,
        province: first.province ?? null,
        lgu: first.lgu ?? null,
        count: list.length,
        participants: list,
      });
    }

    // Sort by lastname, firstname, then province, lgu
    groups.sort((a, b) => {
      const aLast = (a.lastname ?? '').toLowerCase();
      const bLast = (b.lastname ?? '').toLowerCase();
      if (aLast !== bLast) return aLast.localeCompare(bLast);
      const aFirst = (a.firstname ?? '').toLowerCase();
      const bFirst = (b.firstname ?? '').toLowerCase();
      if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
      const aProv = (a.province ?? '').toLowerCase();
      const bProv = (b.province ?? '').toLowerCase();
      if (aProv !== bProv) return aProv.localeCompare(bProv);
      return (a.lgu ?? '').toLowerCase().localeCompare((b.lgu ?? '').toLowerCase());
    });

    return NextResponse.json({ groups });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching duplicates report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
