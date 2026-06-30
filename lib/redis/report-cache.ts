import 'server-only';

import { NextResponse } from 'next/server';
import { isRedisConfigured } from './config';
import { getRedisClientIfConfigured } from './client';
import { redisGet, redisSet } from './operations';

const CACHE_PREFIX = 'report:';

export function isReportCacheEnabled(): boolean {
  if (String(process.env.REDIS_REPORT_CACHE_ENABLED ?? 'true').trim().toLowerCase() === 'false') {
    return false;
  }
  return isRedisConfigured();
}

export function getReportCacheTtlSeconds(): number {
  const raw = process.env.REDIS_REPORT_CACHE_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : 300;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

export function buildReportCacheKey(reportName: string, searchParams: URLSearchParams): string {
  const confcode = searchParams.get('confcode')?.trim() || '_all_';
  const query = Array.from(searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return `${CACHE_PREFIX}${reportName}:${confcode}:${query || '_default_'}`;
}

export async function getCachedReportJson<T>(cacheKey: string): Promise<T | null> {
  if (!isReportCacheEnabled()) return null;

  try {
    const raw = await redisGet(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('[report-cache] read failed:', cacheKey, error);
    return null;
  }
}

export async function setCachedReportJson(
  cacheKey: string,
  payload: unknown,
  ttlSeconds?: number
): Promise<void> {
  if (!isReportCacheEnabled()) return;

  try {
    await redisSet(cacheKey, JSON.stringify(payload), ttlSeconds ?? getReportCacheTtlSeconds());
  } catch (error) {
    console.warn('[report-cache] write failed:', cacheKey, error);
  }
}

export async function tryCachedReportResponse(cacheKey: string): Promise<NextResponse | null> {
  const cached = await getCachedReportJson<object>(cacheKey);
  if (!cached) return null;

  return NextResponse.json(cached, {
    headers: { 'X-Report-Cache': 'HIT' },
  });
}

export async function storeAndRespondReport(
  cacheKey: string,
  payload: object
): Promise<NextResponse> {
  await setCachedReportJson(cacheKey, payload);
  return NextResponse.json(payload, {
    headers: { 'X-Report-Cache': 'MISS' },
  });
}

/** Delete cached report entries for a conference (call after approvals/edits). */
export async function invalidateReportCacheForConference(confcode: string): Promise<number> {
  if (!isReportCacheEnabled()) return 0;

  const client = getRedisClientIfConfigured();
  if (!client) return 0;

  const normalized = confcode.trim();
  if (!normalized) return 0;

  const pattern = `${CACHE_PREFIX}*:${normalized}:*`;
  let cursor = '0';
  let deleted = 0;

  do {
    const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      deleted += await client.del(...keys);
    }
  } while (cursor !== '0');

  if (deleted > 0) {
    console.info(`[report-cache] invalidated ${deleted} key(s) for confcode=${normalized}`);
  }

  return deleted;
}
