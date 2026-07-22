import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { APPROVED_STATUS_VALUES } from '@/lib/registration-status';
import { matchesFoodPreferenceFilter } from '@/lib/food-preference';
import type { FoodPreferenceKind } from '@/lib/food-preference';
import {
  buildReportCacheKey,
  storeAndRespondReport,
  tryCachedReportResponse,
} from '@/lib/redis';

export const dynamic = 'force-dynamic';

const REGID_CHUNK = 120;
const PREFERENCE_FILTERS: FoodPreferenceKind[] = ['ALL', 'ANY_DISH', 'NON_PORK'];

function parsePreferenceFilter(raw: string | null): FoodPreferenceKind {
  const value = String(raw ?? 'ALL').trim().toUpperCase();
  if (PREFERENCE_FILTERS.includes(value as FoodPreferenceKind)) {
    return value as FoodPreferenceKind;
  }
  return 'ALL';
}

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

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');
    const statusFilter = (searchParams.get('status') || 'APPROVED').toUpperCase();
    const preferenceFilter = parsePreferenceFilter(searchParams.get('preference'));
    const view = searchParams.get('view') || 'participant';

    if (!['PENDING', 'APPROVED', 'ALL'].includes(statusFilter)) {
      return NextResponse.json(
        { error: 'status must be PENDING, APPROVED, or ALL' },
        { status: 400 }
      );
    }

    const cacheKey = buildReportCacheKey('food-preference', searchParams);
    const cachedResponse = await tryCachedReportResponse(cacheKey);
    if (cachedResponse) return cachedResponse;

    const { data: registrationsRaw, error: regError } = await fetchAllRecords('regh', (query) => {
      query = query.order('regdate', { ascending: false });
      if (confcode) {
        query = query.eq('confcode', confcode);
      }
      if (statusFilter === 'PENDING') {
        query = query.eq('status', 'PENDING');
      } else if (statusFilter === 'APPROVED') {
        query = query.in('status', [...APPROVED_STATUS_VALUES]);
      } else {
        query = query.in('status', ['PENDING', ...APPROVED_STATUS_VALUES]);
      }
      return query;
    });

    if (regError) {
      console.error('Error fetching registrations for food-preference report:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch registrations' },
        { status: 500 }
      );
    }

    const registrations = registrationsRaw || [];
    const regids = registrations.map((r: any) => r?.regid).filter((id: any) => id);

    let allRegd: any[] = [];
    if (regids.length > 0) {
      const { data: regdRows, error: regdError } = await fetchRegdForRegids(regids);
      if (regdError) {
        console.error('Error fetching participants for food-preference report:', regdError);
        return NextResponse.json(
          { error: 'Failed to fetch participants' },
          { status: 500 }
        );
      }
      allRegd = regdRows || [];
    }

    const foodPreferenceByRegid: Record<string, number> = {};
    const totalByRegid: Record<string, number> = {};

    allRegd.forEach((p: any) => {
      const regid = p.regid;
      if (!regid) return;
      totalByRegid[regid] = (totalByRegid[regid] || 0) + 1;
      if (matchesFoodPreferenceFilter(p.food_preference, preferenceFilter)) {
        foodPreferenceByRegid[regid] = (foodPreferenceByRegid[regid] || 0) + 1;
      }
    });

    const foodPreferenceParticipants = allRegd.filter((p: any) =>
      matchesFoodPreferenceFilter(p.food_preference, preferenceFilter)
    );
    const regsWithFoodPreference = registrations.filter(
      (r: any) => (foodPreferenceByRegid[r.regid] || 0) > 0
    );

    const totalRegistrations = regsWithFoodPreference.length;
    const totalFoodPreferenceParticipants = foodPreferenceParticipants.length;

    if (view === 'participant') {
      const participantsWithRegInfo = foodPreferenceParticipants.map((participant: any) => {
        const registration = registrations.find((r: any) => r.regid === participant.regid);
        return {
          ...participant,
          registration: registration
            ? {
                regid: registration.regid,
                confcode: registration.confcode,
                status: registration.status,
                province: registration.province,
                lgu: registration.lgu,
                contactperson: registration.contactperson,
                contactnum: registration.contactnum,
                email: registration.email,
                regdate: registration.regdate,
              }
            : null,
        };
      });

      return storeAndRespondReport(cacheKey, {
        view: 'participant',
        participants: participantsWithRegInfo,
        total: participantsWithRegInfo.length,
        totalRegistrations,
        totalFoodPreferenceParticipants,
      });
    }

    const registrationsWithCount = regsWithFoodPreference.map((reg: any) => ({
      regid: reg.regid,
      confcode: reg.confcode,
      status: reg.status,
      province: reg.province,
      lgu: reg.lgu,
      contactperson: reg.contactperson,
      contactnum: reg.contactnum,
      email: reg.email,
      regdate: reg.regdate,
      foodPreferenceCount: foodPreferenceByRegid[reg.regid] || 0,
      participantCount: totalByRegid[reg.regid] || 0,
    }));

    return storeAndRespondReport(cacheKey, {
      view: 'registration',
      registrations: registrationsWithCount,
      total: registrationsWithCount.length,
      totalRegistrations,
      totalFoodPreferenceParticipants,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching food-preference report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
