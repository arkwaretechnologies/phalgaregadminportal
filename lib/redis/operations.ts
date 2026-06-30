import 'server-only';

import { getRedisClient } from './client';

function serializeValue(value: string | number | boolean | Record<string, unknown>): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function logRedisOperationError(operation: string, key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[redis] ${operation} failed for key="${key}":`, message);
}

export async function redisSet(
  key: string,
  value: string | number | boolean | Record<string, unknown>,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedisClient();
  const payload = serializeValue(value);

  try {
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      await client.set(key, payload, 'EX', ttlSeconds);
      return;
    }
    await client.set(key, payload);
  } catch (error) {
    logRedisOperationError('SET', key, error);
    throw error;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  const client = getRedisClient();

  try {
    return await client.get(key);
  } catch (error) {
    logRedisOperationError('GET', key, error);
    throw error;
  }
}

export async function redisDelete(...keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;

  const client = getRedisClient();

  try {
    return await client.del(...keys);
  } catch (error) {
    logRedisOperationError('DEL', keys.join(','), error);
    throw error;
  }
}

export async function redisExpire(key: string, seconds: number): Promise<boolean> {
  const client = getRedisClient();

  try {
    const result = await client.expire(key, seconds);
    return result === 1;
  } catch (error) {
    logRedisOperationError('EXPIRE', key, error);
    throw error;
  }
}

export async function redisIncrement(key: string, by = 1): Promise<number> {
  const client = getRedisClient();

  try {
    return await client.incrby(key, by);
  } catch (error) {
    logRedisOperationError('INCRBY', key, error);
    throw error;
  }
}

/*
 * Usage examples:
 *
 * import { redisSet, redisGet, redisDelete, redisExpire, redisIncrement } from '@/lib/redis';
 *
 * await redisSet('session:abc', { userId: 1 }, 3600);
 * const raw = await redisGet('session:abc');
 * await redisExpire('session:abc', 7200);
 * await redisIncrement('page:views:home');
 * await redisDelete('session:abc');
 */
