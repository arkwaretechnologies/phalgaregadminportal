import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import {
  buildParticipantDuplicateMap,
  buildParticipantDuplicateRecord,
} from '@/lib/participant-duplicates';

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

async function resolveRegistration(regnum: string) {
  const decodedRegnum = decodeURIComponent(regnum);

  const { data: regById, error: errorById } = await supabaseServer
    .from('regh')
    .select('regid, confcode')
    .eq('regid', decodedRegnum)
    .maybeSingle();

  if (!errorById && regById) {
    return regById;
  }

  const batchnum = parseInt(regnum, 10);
  const isNumeric = !Number.isNaN(batchnum) && /^\d+$/.test(regnum);

  if (isNumeric) {
    const { data: regByBatch, error: errorByBatch } = await supabaseServer
      .from('regh')
      .select('regid, confcode')
      .eq('batchnum', batchnum)
      .maybeSingle();

    if (!errorByBatch && regByBatch) {
      return regByBatch;
    }
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const registration = await resolveRegistration(params.regnum);
    if (!registration?.regid) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const confcode = String(registration.confcode ?? '').trim();
    if (!confcode) {
      return NextResponse.json({ duplicatesByLinenum: {} });
    }

    const { data: currentRegd, error: currentRegdError } = await supabaseServer
      .from('regd')
      .select('*')
      .eq('regid', registration.regid)
      .order('linenum', { ascending: true });

    if (currentRegdError) {
      console.error('Error fetching current registration participants:', currentRegdError);
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      );
    }

    const participants = currentRegd ?? [];
    if (participants.length === 0) {
      return NextResponse.json({ duplicatesByLinenum: {} });
    }

    const { data: allRegd, error: allRegdError } = await fetchAllRecords(
      supabaseServer,
      'regd',
      (query) =>
        query
          .eq('confcode', confcode)
          .order('regid', { ascending: true })
          .order('linenum', { ascending: true })
    );

    if (allRegdError) {
      console.error('Error fetching conference participants:', allRegdError);
      return NextResponse.json(
        { error: 'Failed to fetch conference participants' },
        { status: 500 }
      );
    }

    const regids = Array.from(
      new Set((allRegd ?? []).map((row: any) => row?.regid).filter(Boolean))
    ) as string[];

    const registrationByRegid = new Map<string, { regid: string; status: string | null; regdate: string | null }>();

    const CHUNK_SIZE = 200;
    for (let i = 0; i < regids.length; i += CHUNK_SIZE) {
      const chunk = regids.slice(i, i + CHUNK_SIZE);
      const { data: reghRows, error: reghError } = await supabaseServer
        .from('regh')
        .select('regid, status, regdate')
        .in('regid', chunk);

      if (reghError) {
        console.error('Error fetching registration summaries:', reghError);
        return NextResponse.json(
          { error: 'Failed to fetch registration summaries' },
          { status: 500 }
        );
      }

      for (const row of reghRows ?? []) {
        if (row?.regid) {
          registrationByRegid.set(row.regid, {
            regid: row.regid,
            status: row.status ?? null,
            regdate: row.regdate ?? null,
          });
        }
      }
    }

    const allConferenceRegdWithReg = (allRegd ?? []).map((row: any) => ({
      ...row,
      registration: row.regid ? registrationByRegid.get(row.regid) ?? null : null,
    }));

    const duplicateMap = buildParticipantDuplicateMap(
      registration.regid,
      participants,
      allConferenceRegdWithReg
    );

    return NextResponse.json({
      duplicatesByLinenum: buildParticipantDuplicateRecord(duplicateMap),
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Participant duplicates fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
