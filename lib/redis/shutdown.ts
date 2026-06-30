import 'server-only';

import type Redis from 'ioredis';

const SHUTDOWN_TIMEOUT_MS = 5_000;

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisClosing?: boolean;
};

export async function closeRedis(): Promise<void> {
  const client = globalForRedis.redis;
  if (!client || globalForRedis.redisClosing) {
    return;
  }

  globalForRedis.redisClosing = true;

  try {
    await Promise.race([
      client.quit(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('redis shutdown timed out')), SHUTDOWN_TIMEOUT_MS);
      }),
    ]);
    console.info('[redis] connection closed gracefully');
  } catch (error) {
    console.warn('[redis] quit failed, forcing disconnect:', error);
    client.disconnect();
  } finally {
    globalForRedis.redis = undefined;
    globalForRedis.redisClosing = false;
  }
}
