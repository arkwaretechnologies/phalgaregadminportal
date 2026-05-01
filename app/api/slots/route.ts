import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getRegistrationLimit(confcode: string | null): Promise<number | null> {
  // If confcode is provided, get limit from conference table
  if (confcode) {
    const { data, error } = await supabase
      .from('conference')
      .select('reg_limit')
      .eq('confcode', confcode)
      .maybeSingle();

    if (error) {
      console.error('Error fetching conference reg_limit:', error);
      return null;
    }

    const limit = data?.reg_limit ?? null;
    if (limit === null) return null;

    const n = Number(limit);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }

  // Fallback to config table if no confcode
  const { data, error } = await supabase
    .from('config')
    .select('paramvalue')
    .eq('paramname', 'REGISTRATION_LIMIT')
    .maybeSingle();

  if (error) {
    console.error('Error fetching REGISTRATION_LIMIT:', error);
    return null;
  }

  const raw = data?.paramvalue ?? null;
  if (raw === null || raw === '') return null;

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

async function getUsedSlots(confcode: string | null): Promise<number> {
  // Count participants (regd rows) whose parent registration (regh) is PENDING or APPROVED.
  // REJECTED registrations are excluded — their slots are freed.
  // NULL status is treated as PENDING.
  //
  // Supabase caps SELECT responses at 1000 rows by default, so we must
  // paginate through all eligible regh rows to collect every regid.
  const PAGE_SIZE = 1000;
  const allRegids: string[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('regh')
      .select('regid');

    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    query = query.or(
      `status.is.null,status.eq.PENDING,status.in.(APPROVED,"APPROVED PARTICIPANT AND ACCOMPANYING")`
    );
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching eligible regids:', error);
      break;
    }

    if (data && data.length > 0) {
      for (const r of data) {
        const id = (r as any)?.regid;
        if (id != null && id !== '') allRegids.push(id);
      }
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  if (allRegids.length === 0) return 0;

  // Count regd rows for the collected regids. No additional confcode filter
  // on regd — the regids already belong to the correct conference, and
  // regd.confcode may be null for some rows.
  const CHUNK_SIZE = 500;
  let total = 0;

  for (let i = 0; i < allRegids.length; i += CHUNK_SIZE) {
    const chunk = allRegids.slice(i, i + CHUNK_SIZE);
    const { count, error: regdError } = await supabase
      .from('regd')
      .select('regid', { count: 'exact', head: true })
      .in('regid', chunk);

    if (regdError) {
      console.error('Error counting regd rows:', regdError);
      continue;
    }

    total += count ?? 0;
  }

  return total;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    const [limit, used] = await Promise.all([
      getRegistrationLimit(confcode),
      getUsedSlots(confcode),
    ]);

    const remaining = limit === null ? null : Math.max(0, limit - used);

    return NextResponse.json({ limit, used, remaining });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Slots GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

