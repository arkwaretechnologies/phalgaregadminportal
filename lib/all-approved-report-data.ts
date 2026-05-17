import type { SupabaseClient } from '@supabase/supabase-js';
import {
  conferenceIsAward,
  conferenceUsesAwardApprovedReportStatuses,
  getAllApprovedReportStatusFilter,
  isAllApprovedReportStatus,
  isIsAwardApprovedReportReghStatus,
} from '@/lib/registration-status';

const REGID_IN_CHUNK_SIZE = 120;

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
  confcode: string | null,
  pageSize: number
): Promise<{ data: any[]; error: any }> {
  const merged: any[] = [];

  for (let i = 0; i < regids.length; i += REGID_IN_CHUNK_SIZE) {
    const chunk = regids.slice(i, i + REGID_IN_CHUNK_SIZE);
    const { data, error } = await fetchAllRecords(
      client,
      'regd',
      (query) => {
        let q = query
          .in('regid', chunk)
          .order('regid', { ascending: true })
          .order('linenum', { ascending: true });
        if (confcode) {
          q = q.eq('confcode', confcode);
        }
        return q;
      },
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

export type ConferenceMeta = {
  confcode: string | null;
  is_award: string | null;
};

export type AllApprovedReportData = {
  conferenceMeta: ConferenceMeta | null;
  isAwardConference: boolean;
  approvedRegistrations: any[];
  dbParticipants: any[];
  regids: string[];
};

/**
 * Same regh/regd selection as Reports → All Approved Report.
 * For `is_award = Y`: regh.status IN ('ACCEPTED', 'APPROVED REPRESENTATIVE AND ACCOMPANYING')
 * and all regd rows for those registrations (no synthetic representative rows).
 */
export async function fetchAllApprovedReportData(
  client: SupabaseClient,
  confcode: string | null
): Promise<{ data: AllApprovedReportData | null; error: any }> {
  let conferenceMeta: ConferenceMeta | null = null;
  if (confcode) {
    const { data: confRow } = await client
      .from('conference')
      .select('confcode, is_award')
      .eq('confcode', confcode.trim())
      .maybeSingle();
    conferenceMeta = confRow
      ? { confcode: confRow.confcode, is_award: confRow.is_award }
      : { confcode: confcode.trim(), is_award: null };
  }

  const isAwardConference = conferenceIsAward(conferenceMeta?.is_award);
  const useAwardApprovedStatuses = conferenceUsesAwardApprovedReportStatuses(conferenceMeta);
  const reportStatusFilter = [...getAllApprovedReportStatusFilter(conferenceMeta)];

  const { data: rawApprovedRegistrations, error: regError } = await fetchAllRecords(
    client,
    'regh',
    (query) => {
      query = query.in('status', reportStatusFilter).order('regdate', { ascending: false });
      if (confcode) {
        query = query.eq('confcode', confcode);
      }
      return query;
    }
  );

  if (regError) {
    return { data: null, error: regError };
  }

  const approvedRegistrations = isAwardConference
    ? (rawApprovedRegistrations || []).filter((r: any) =>
        isIsAwardApprovedReportReghStatus(r?.status)
      )
    : useAwardApprovedStatuses
      ? (rawApprovedRegistrations || []).filter((r: any) => isAllApprovedReportStatus(r?.status))
      : rawApprovedRegistrations || [];

  const regids = approvedRegistrations
    .map((r: any) => r?.regid)
    .filter((id: any) => id);

  let dbParticipants: any[] = [];
  if (regids.length > 0) {
    const { data: regdRows, error: regdError } = await fetchRegdByRegIds(
      client,
      regids,
      confcode,
      1000
    );
    if (regdError) {
      return { data: null, error: regdError };
    }
    dbParticipants = regdRows || [];
  }

  return {
    data: {
      conferenceMeta,
      isAwardConference,
      approvedRegistrations,
      dbParticipants,
      regids,
    },
    error: null,
  };
}
