import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import { APPROVED_STATUS_VALUES } from '@/lib/registration-status';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/** PostgREST `.in('regid', …)` is sent on the query string; keep chunks well under URL limits. */
const REGID_IN_CHUNK_SIZE = 120;

// Helper function to fetch all records without Supabase's default 1000 row limit
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

async function fetchRegdByRegIds(
  client: SupabaseClient,
  regids: string[],
  pageSize: number
): Promise<{ data: any[]; error: any }> {
  const merged: any[] = [];

  for (let i = 0; i < regids.length; i += REGID_IN_CHUNK_SIZE) {
    const chunk = regids.slice(i, i + REGID_IN_CHUNK_SIZE);
    const { data, error } = await fetchAllRecords(
      client,
      'regd',
      (query) =>
        query.in('regid', chunk).order('regid', { ascending: true }).order('linenum', { ascending: true }),
      pageSize
    );
    if (error) {
      return { data: [], error };
    }
    if (data?.length) {
      merged.push(...data);
    }
  }

  merged.sort((a, b) => {
    const ra = String(a.regid ?? '');
    const rb = String(b.regid ?? '');
    if (ra !== rb) return ra.localeCompare(rb);
    return Number(a.linenum ?? 0) - Number(b.linenum ?? 0);
  });

  return { data: merged, error: null };
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    const view = searchParams.get('view') || 'participant';

    // Fetch approved registrations (no row limit)
    const { data: approvedRegistrations, error: regError } = await fetchAllRecords(
      supabaseServer,
      'regh',
      (query) => {
        query = query.in('status', [...APPROVED_STATUS_VALUES]).order('regdate', { ascending: false });
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

    const regids = (approvedRegistrations || []).map((r: any) => r?.regid).filter((id: any) => id);

    let allParticipants: any[] = [];

    if (regids.length > 0) {
      const { data: regdRows, error: regdError } = await fetchRegdByRegIds(
        supabaseServer,
        regids,
        1000
      );

      if (regdError) {
        console.error('Error fetching participants:', regdError);
      } else {
        allParticipants = regdRows || [];
      }
    }

    const totalRegistrations = (approvedRegistrations || []).length;
    const totalParticipants = allParticipants.length;

    if (view === 'registration') {
      const participantCountMap: Record<string, number> = {};
      allParticipants.forEach((p: any) => {
        const regid = p.regid;
        if (regid) {
          participantCountMap[regid] = (participantCountMap[regid] || 0) + 1;
        }
      });

      const registrationsWithCount = (approvedRegistrations || []).map((reg: any) => ({
        regid: reg.regid,
        batchnum: reg.batchnum,
        confcode: reg.confcode,
        province: reg.province,
        lgu: reg.lgu,
        contactperson: reg.contactperson,
        contactnum: reg.contactnum,
        email: reg.email,
        regdate: reg.regdate,
        participantCount: participantCountMap[reg.regid] || 0,
      }));

      return NextResponse.json({
        view: 'registration',
        registrations: registrationsWithCount,
        total: registrationsWithCount.length,
        totalRegistrations,
        totalParticipants,
      });
    }

    const participantsWithRegInfo = allParticipants.map((participant: any) => {
      const registration = (approvedRegistrations || []).find((r: any) => r.regid === participant.regid);
      return {
        ...participant,
        registration: registration ? {
          regid: registration.regid,
          batchnum: registration.batchnum,
          confcode: registration.confcode,
          province: registration.province,
          lgu: registration.lgu,
          contactperson: registration.contactperson,
          contactnum: registration.contactnum,
          email: registration.email,
          regdate: registration.regdate,
        } : null,
      };
    });

    return NextResponse.json({
      view: 'participant',
      participants: participantsWithRegInfo,
      total: participantsWithRegInfo.length,
      totalRegistrations,
      totalParticipants,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
