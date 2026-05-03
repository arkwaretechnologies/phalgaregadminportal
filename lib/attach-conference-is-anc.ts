import { supabaseServer } from '@/lib/supabase-server';
import type { RegistrationDetail } from '@/types';

/** `conference.reg_fee` is `numeric` in Postgres; PostgREST JSON often uses a string for precision. */
function parseConferenceRegFee(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'bigint') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[₱,\s]/g, '').trim();
    if (cleaned === '') return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  // Rare: some clients deserialize numeric into a plain object
  if (typeof raw === 'object' && raw !== null && 'toString' in raw) {
    const s = String(raw);
    if (s !== '[object Object]') {
      return parseConferenceRegFee(s);
    }
  }
  return null;
}

/**
 * Match `regh.confcode` to `conference.confcode`. PK equality is case-sensitive in Postgres;
 * registrations sometimes store a different casing than the conference row (e.g. 2026-anc vs 2026-ANC).
 */
async function fetchConferenceRow(confcode: string) {
  const trimmed = confcode.trim();

  async function tryLookup(code: string) {
    const { data: byEq, error: errEq } = await supabaseServer
      .from('conference')
      .select('*')
      .eq('confcode', code)
      .maybeSingle();

    if (errEq) {
      return { data: null as Record<string, unknown> | null, error: errEq };
    }
    if (byEq) {
      return { data: byEq as Record<string, unknown>, error: null };
    }

    // Escape % and _ so ILIKE treats them literally (confcode is usually short, e.g. 2026-ANC)
    const escaped = code.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const { data: byIlike, error: errIlike } = await supabaseServer
      .from('conference')
      .select('*')
      .ilike('confcode', escaped)
      .maybeSingle();

    if (errIlike) {
      return { data: null, error: errIlike };
    }
    return { data: byIlike as Record<string, unknown> | null, error: null };
  }

  // 1) Exact/ilike match for the confcode as-is
  const first = await tryLookup(trimmed);
  if (first.error || first.data) return first;

  // 2) Common data issue: underscore used instead of hyphen in some tables/inputs.
  const normalized = trimmed.includes('_') ? trimmed.replace(/_/g, '-') : null;
  if (normalized && normalized !== trimmed) {
    return await tryLookup(normalized);
  }

  return first;
}

function regFeeFromConferenceRow(row: Record<string, unknown>): number | null {
  const candidates = [row.reg_fee, row.registration_fee];
  for (const c of candidates) {
    const n = parseConferenceRegFee(c);
    if (n !== null) return n;
  }
  return null;
}

export async function attachConferenceIsAnc(
  registration: RegistrationDetail
): Promise<RegistrationDetail> {
  // Some historical rows may have `regh.confcode` missing; fall back to the first participant's confcode.
  const derivedConfcode =
    registration.confcode ?? registration.regd?.[0]?.confcode ?? null;

  if (!derivedConfcode) {
    return { ...registration, is_anc: null, reg_fee: null, is_award: null };
  }

  const confcode = String(derivedConfcode).trim();
  const { data, error } = await fetchConferenceRow(confcode);

  if (error) {
    console.error('attachConferenceIsAnc: conference fetch failed', error);
    return { ...registration, is_anc: null, reg_fee: null, is_award: null };
  }

  if (!data) {
    return { ...registration, is_anc: null, reg_fee: null, is_award: null };
  }

  const row = data;
  const reg_fee = regFeeFromConferenceRow(row);

  return {
    ...registration,
    is_anc: (row.is_anc as string | null | undefined) ?? null,
    reg_fee,
    is_award: (row.is_award as string | null | undefined) ?? null,
  };
}
