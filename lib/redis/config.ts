import type { RedisOptions } from 'ioredis';

export type RedisConfig =
  | { mode: 'url'; url: string; options: RedisOptions }
  | { mode: 'host'; options: RedisOptions };

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDbIndex(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isTruthy(value: string | undefined): boolean {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function sharedOptions(): RedisOptions {
  return {
    connectTimeout: parsePositiveInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 10_000),
    commandTimeout: parsePositiveInt(process.env.REDIS_COMMAND_TIMEOUT_MS, 5_000),
    maxRetriesPerRequest: parsePositiveInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST, 3),
    enableReadyCheck: true,
    lazyConnect: true,
  };
}

export function isRedisConfigured(): boolean {
  const url = process.env.REDIS_URL?.trim();
  const host = process.env.REDIS_HOST?.trim();
  return Boolean(url || host);
}

export function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return {
      mode: 'url',
      url,
      options: sharedOptions(),
    };
  }

  const host = process.env.REDIS_HOST?.trim();
  if (!host) {
    throw new Error('Redis is not configured: set REDIS_URL or REDIS_HOST');
  }

  const port = parsePositiveInt(process.env.REDIS_PORT, 6379);
  const username = process.env.REDIS_USERNAME?.trim();
  const password = process.env.REDIS_PASSWORD;
  const db = parseDbIndex(process.env.REDIS_DB);
  const tls = isTruthy(process.env.REDIS_TLS) ? {} : undefined;

  const options: RedisOptions = {
    ...sharedOptions(),
    host,
    port,
    db,
    ...(username ? { username } : {}),
    ...(password !== undefined && password !== '' ? { password } : {}),
    ...(tls ? { tls } : {}),
  };

  return { mode: 'host', options };
}
