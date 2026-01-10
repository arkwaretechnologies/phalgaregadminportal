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

async function getUsedSlotsFromRegD(confcode: string | null): Promise<number> {
  // Count participants (regD rows) for registrations that are PENDING or APPROVED.
  // REJECTED registrations are excluded (their slots are freed up).
  // Treat NULL status as PENDING to match UI behavior.
  // Filter by confcode if provided
  // Use regid instead of batchnum because PENDING registrations don't have batchnum yet
  let query = supabase
    .from('regh')
    .select('regid');

  if (confcode) {
    query = query.eq('confcode', confcode);
  }

  // Include PENDING, APPROVED, and NULL status (treat NULL as PENDING)
  // Exclude REJECTED
  query = query.or('status.in.(PENDING,APPROVED),status.is.null');

  const { data: eligibleRegs, error: reghError } = await query;

  if (reghError) {
    console.error('Error fetching eligible regids:', reghError);
    return 0;
  }

  const regids = (eligibleRegs || [])
    .map((r: any) => r?.regid)
    .filter((id: any) => id != null && id !== '');

  if (regids.length === 0) return 0;

  // Chunk to avoid URL length / parameter limits.
  const CHUNK_SIZE = 500;
  let total = 0;

  for (let i = 0; i < regids.length; i += CHUNK_SIZE) {
    const chunk = regids.slice(i, i + CHUNK_SIZE);
    let regdQuery = supabase
      .from('regd')
      .select('regid', { count: 'exact', head: true })
      .in('regid', chunk);

    // Also filter by confcode if provided
    if (confcode) {
      regdQuery = regdQuery.eq('confcode', confcode);
    }

    const { count, error: regdError } = await regdQuery;

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
      getUsedSlotsFromRegD(confcode),
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

