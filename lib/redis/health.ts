import 'server-only';

import { isRedisConfigured } from './config';
import { getRedisClient } from './client';

export type RedisHealthResult = {
  ok: boolean;
  latencyMs: number;
  error?: string;
};

export async function checkRedisHealth(): Promise<RedisHealthResult> {
  if (!isRedisConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      error: 'not_configured',
    };
  }

  const started = Date.now();

  try {
    const client = getRedisClient();
    const response = await client.ping();
    const latencyMs = Date.now() - started;

    if (response !== 'PONG') {
      return {
        ok: false,
        latencyMs,
        error: `unexpected_ping_response:${response}`,
      };
    }

    return { ok: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      latencyMs,
      error: message,
    };
  }
}
