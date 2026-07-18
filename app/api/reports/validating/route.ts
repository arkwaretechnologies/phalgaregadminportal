import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import {
  buildReportCacheKey,
  storeAndRespondReport,
  tryCachedReportResponse,
} from '@/lib/redis';

export const dynamic = 'force-dynamic';

const REGID_CHUNK = 120;

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

async function fetchRegdForRegids(regids: string[]): Promise<{ data: any[]; error: any }> {
  const merged: any[] = [];

  for (let i = 0; i < regids.length; i += REGID_CHUNK) {
    const chunk = regids.slice(i, i + REGID_CHUNK);
    const { data, error } = await fetchAllRecords('regd', (query) =>
      query.in('regid', chunk).order('regid', { ascending: true }).order('linenum', { ascending: true })
    );
    if (error) {
      return { data: [], error };
    }
    if (data?.length) {
      merged.push(...data);
    }
  }

  return { data: merged, error: null };
}

function sortByValidationNo(rows: any[]): any[] {
  return [...rows].sort((a, b) => {
    const va = a.validation_no;
    const vb = b.validation_no;
    const na = typeof va === 'number' ? va : Number(va);
    const nb = typeof vb === 'number' ? vb : Number(vb);
    const aNull = va == null || !Number.isFinite(na);
    const bNull = vb == null || !Number.isFinite(nb);
    if (aNull && bNull) {
      const da = a.regdate ? new Date(a.regdate).getTime() : 0;
      const db = b.regdate ? new Date(b.regdate).getTime() : 0;
      return db - da;
    }
    if (aNull) return 1;
    if (bNull) return -1;
    if (na !== nb) return na - nb;
    const da = a.regdate ? new Date(a.regdate).getTime() : 0;
    const db = b.regdate ? new Date(b.regdate).getTime() : 0;
    return db - da;
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');
    const view = searchParams.get('view') || 'registration';

    const cacheKey = buildReportCacheKey('validating', searchParams);
    const cachedResponse = await tryCachedReportResponse(cacheKey);
    if (cachedResponse) return cachedResponse;

    const { data: validatingRegistrationsRaw, error: regError } = await fetchAllRecords(
      'regh',
      (query) => {
        query = query.eq('is_validating', 'Y').order('validation_no', { ascending: true });
        if (confcode) {
          query = query.eq('confcode', confcode);
        }
        return query;
      }
    );

    if (regError) {
      console.error('Error fetching validating registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch validating registrations' },
        { status: 500 }
      );
    }

    const validatingRegistrations = sortByValidationNo(validatingRegistrationsRaw || []);
    const regids = validatingRegistrations.map((r: any) => r?.regid).filter((id: any) => id);

    let conferenceIsAnc = false;
    if (confcode) {
      const { data: confRow } = await supabase
        .from('conference')
        .select('is_anc')
        .eq('confcode', confcode.trim())
        .maybeSingle();
      conferenceIsAnc = String(confRow?.is_anc ?? '').toUpperCase() === 'Y';
    }

    let allParticipants: any[] = [];
    if (regids.length > 0) {
      const { data: regdRows, error: regdError } = await fetchRegdForRegids(regids);
      if (regdError) {
        console.error('Error fetching participants:', regdError);
      } else {
        allParticipants = regdRows || [];
      }
    }

    const totalRegistrations = validatingRegistrations.length;
    const totalParticipants = allParticipants.length;

    if (view === 'participant') {
      const participantsWithRegInfo = allParticipants.map((participant: any) => {
        const registration = validatingRegistrations.find((r: any) => r.regid === participant.regid);
        return {
          ...participant,
          registration: registration
            ? {
                regid: registration.regid,
                confcode: registration.confcode,
                province: registration.province,
                lgu: registration.lgu,
                contactperson: registration.contactperson,
                contactnum: registration.contactnum,
                email: registration.email,
                regdate: registration.regdate,
                validation_no: registration.validation_no ?? null,
              }
            : null,
        };
      });

      participantsWithRegInfo.sort((a, b) => {
        const va = a.registration?.validation_no;
        const vb = b.registration?.validation_no;
        const na = typeof va === 'number' ? va : Number(va);
        const nb = typeof vb === 'number' ? vb : Number(vb);
        const aNull = va == null || !Number.isFinite(na);
        const bNull = vb == null || !Number.isFinite(nb);
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        return na - nb;
      });

      return storeAndRespondReport(cacheKey, {
        view: 'participant',
        participants: participantsWithRegInfo,
        total: participantsWithRegInfo.length,
        totalRegistrations,
        totalParticipants,
      });
    }

    const participantCountMap: Record<string, number> = {};
    allParticipants.forEach((p: any) => {
      const regid = p.regid;
      if (regid) {
        participantCountMap[regid] = (participantCountMap[regid] || 0) + 1;
      }
    });

    const registrationsWithCount = validatingRegistrations.map((reg: any) => ({
      regid: reg.regid,
      confcode: reg.confcode,
      province: reg.province,
      lgu: reg.lgu,
      contactperson: reg.contactperson,
      contactnum: reg.contactnum,
      email: reg.email,
      regdate: reg.regdate,
      validation_no: reg.validation_no ?? null,
      participantCount: participantCountMap[reg.regid] || 0,
    }));

    return storeAndRespondReport(cacheKey, {
      view: 'registration',
      registrations: registrationsWithCount,
      total: registrationsWithCount.length,
      totalRegistrations,
      totalParticipants,
      ancRegdParticipants: conferenceIsAnc ? allParticipants : undefined,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching validating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
