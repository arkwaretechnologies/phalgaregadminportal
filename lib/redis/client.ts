import 'server-only';

import Redis from 'ioredis';
import { getRedisConfig, isRedisConfigured } from './config';

const MAX_RETRY_ATTEMPTS = 20;
const MAX_RETRY_DELAY_MS = 2_000;

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisListenersAttached?: boolean;
};

function retryStrategy(times: number): number | null {
  if (times > MAX_RETRY_ATTEMPTS) {
    console.error(`[redis] giving up after ${MAX_RETRY_ATTEMPTS} reconnect attempts`);
    return null;
  }
  const delay = Math.min(times * 200, MAX_RETRY_DELAY_MS);
  return delay;
}

function reconnectOnError(error: Error): boolean | 1 | 2 {
  const message = error.message.toLowerCase();
  if (message.includes('readonly')) {
    return true;
  }
  if (message.includes('econnreset') || message.includes('etimedout')) {
    return true;
  }
  return false;
}

function attachEventLogging(client: Redis): void {
  if (globalForRedis.redisListenersAttached) return;

  client.on('connect', () => {
    console.info('[redis] connected');
  });

  client.on('ready', () => {
    console.info('[redis] ready');
  });

  client.on('error', (error: Error) => {
    console.error('[redis] error:', error.message);
  });

  client.on('close', () => {
    console.warn('[redis] connection closed');
  });

  client.on('reconnecting', (delay: number) => {
    console.warn(`[redis] reconnecting in ${delay}ms`);
  });

  globalForRedis.redisListenersAttached = true;
}

function createRedisClient(): Redis {
  const config = getRedisConfig();
  const client =
    config.mode === 'url'
      ? new Redis(config.url, {
          ...config.options,
          retryStrategy,
          reconnectOnError,
        })
      : new Redis({
          ...config.options,
          retryStrategy,
          reconnectOnError,
        });

  attachEventLogging(client);
  return client;
}

export function getRedisClient(): Redis {
  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured: set REDIS_URL or REDIS_HOST');
  }

  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient();
  }

  return globalForRedis.redis;
}

export function getRedisClientIfConfigured(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }
  return getRedisClient();
}
