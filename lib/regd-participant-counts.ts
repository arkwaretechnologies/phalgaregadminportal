import type { SupabaseClient } from '@supabase/supabase-js';

/** PostgREST `.in('regid', …)` is sent on the query string; keep chunks under URL limits. */
const REGID_IN_CHUNK = 120;

/**
 * Returns how many `regd` rows exist per `regid`, using a small number of queries
 * instead of one count request per registration (avoids rate limits / failed parallel requests).
 */
export async function getParticipantCountsByRegids(
  client: SupabaseClient,
  regids: (string | number | null | undefined)[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const normalized = Array.from(
    new Set(
      regids.filter((id) => id != null && id !== '').map((id) => String(id).trim())
    )
  );

  if (normalized.length === 0) {
    return counts;
  }

  for (let i = 0; i < normalized.length; i += REGID_IN_CHUNK) {
    const chunk = normalized.slice(i, i + REGID_IN_CHUNK);

    // Paginate through all regd rows for this chunk — PostgREST defaults to 1000 rows
    // per request, so we keep fetching pages until fewer rows than PAGE_SIZE are returned.
    const PAGE_SIZE = 1000;
    let offset = 0;
    let done = false;

    while (!done) {
      const { data, error } = await client
        .from('regd')
        .select('regid')
        .in('regid', chunk)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('getParticipantCountsByRegids:', error);
        break;
      }

      for (const row of data || []) {
        if (row?.regid == null) continue;
        const key = String(row.regid).trim();
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      if (!data || data.length < PAGE_SIZE) {
        done = true;
      } else {
        offset += PAGE_SIZE;
      }
    }
  }

  return counts;
}
