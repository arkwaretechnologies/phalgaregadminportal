import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import {
  APPROVED_STATUS_VALUES,
  isRepresentativeRegdFirstname,
} from '@/lib/registration-status';
import { isNonPorkFlag } from '@/lib/non-pork';
import {
  buildReportCacheKey,
  storeAndRespondReport,
  tryCachedReportResponse,
} from '@/lib/redis';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function getRepresentativeDesignationFromRegh(reg: any): string | null {
  const candidates = [
    reg?.designation,
    reg?.rep_designation,
    reg?.representative_designation,
    reg?.position,
    reg?.posname,
    reg?.title,
  ];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return null;
}

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

    const cacheKey = buildReportCacheKey('participants', searchParams);
    const cachedResponse = await tryCachedReportResponse(cacheKey);
    if (cachedResponse) return cachedResponse;

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

    const conferenceCodes = Array.from(
      new Set((approvedRegistrations || []).map((r: any) => r?.confcode).filter(Boolean))
    ) as string[];
    let awardConferenceSet = new Set<string>();
    if (conferenceCodes.length > 0) {
      const { data: conferenceRows } = await supabaseServer
        .from('conference')
        .select('confcode, is_award')
        .in('confcode', conferenceCodes);
      awardConferenceSet = new Set(
        (conferenceRows || [])
          .filter((c: any) => String(c?.is_award ?? '').toUpperCase() === 'Y')
          .map((c: any) => c.confcode)
          .filter(Boolean)
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

    // Award flow safeguard: if representative row isn't present in regd,
    // synthesize one so approved reports always include representative + accompanying.
    if (allParticipants.length > 0 && (approvedRegistrations || []).length > 0) {
      let syntheticLineNum = -1;
      const participantsByRegid = new Map<string, any[]>();
      for (const p of allParticipants) {
        const key = String(p?.regid ?? '');
        if (!key) continue;
        const arr = participantsByRegid.get(key) || [];
        arr.push(p);
        participantsByRegid.set(key, arr);
      }

      for (const reg of approvedRegistrations || []) {
        const regid = String(reg?.regid ?? '');
        const conf = String(reg?.confcode ?? '');
        if (!regid || !conf || !awardConferenceSet.has(conf)) continue;

        const existingRows = participantsByRegid.get(regid) || [];
        const hasRepresentative = existingRows.some((row) =>
          isRepresentativeRegdFirstname(row?.firstname)
        );
        if (hasRepresentative) continue;

        const repDesignation = getRepresentativeDesignationFromRegh(reg) ?? 'REPRESENTATIVE';
        const synthetic = {
          regid,
          confcode: reg.confcode ?? null,
          batchnum: reg.batchnum ?? null,
          linenum: syntheticLineNum--,
          lastname: reg.contactperson || 'N/A',
          firstname: 'REPRESENTATIVE',
          middleinit: null,
          suffix: null,
          designation: repDesignation,
          brgy: null,
          lgu: reg.lgu ?? null,
          province: reg.province ?? null,
          tshirtsize: null,
          contactnum: reg.contactnum ?? null,
          prcnum: null,
          expirydate: null,
          email: reg.email ?? null,
        };
        allParticipants.push(synthetic);
      }
    }

    const totalRegistrations = (approvedRegistrations || []).length;
    const totalParticipants = allParticipants.length;

    if (view === 'registration') {
      const participantCountMap: Record<string, number> = {};
      const nonPorkCountMap: Record<string, number> = {};
      allParticipants.forEach((p: any) => {
        const regid = p.regid;
        if (regid) {
          participantCountMap[regid] = (participantCountMap[regid] || 0) + 1;
          if (isNonPorkFlag(p.non_pork)) {
            nonPorkCountMap[regid] = (nonPorkCountMap[regid] || 0) + 1;
          }
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
        nonPorkCount: nonPorkCountMap[reg.regid] || 0,
      }));

      return storeAndRespondReport(cacheKey, {
        view: 'registration',
        registrations: registrationsWithCount,
        total: registrationsWithCount.length,
        totalRegistrations,
        totalParticipants,
      });
    }

    const registrationsByRegid = new Map<string, any>();
    for (const r of approvedRegistrations || []) {
      const key = String((r as any)?.regid ?? '');
      if (key) registrationsByRegid.set(key, r);
    }

    const participantsWithRegInfo = allParticipants.map((participant: any) => {
      const registration = registrationsByRegid.get(String(participant.regid ?? '')) ?? null;
      const conf = String(registration?.confcode ?? participant?.confcode ?? '');
      const isAwardConf = conf && awardConferenceSet.has(conf);
      const isRepresentative = isRepresentativeRegdFirstname(participant?.firstname);
      const repDesignation =
        isAwardConf && isRepresentative
          ? getRepresentativeDesignationFromRegh(registration) ?? participant?.designation ?? 'REPRESENTATIVE'
          : participant?.designation;
      return {
        ...participant,
        designation: repDesignation,
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

    return storeAndRespondReport(cacheKey, {
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
