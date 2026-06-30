import { NextResponse } from 'next/server';
import { checkRedisHealth } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Public health probe for load balancers / uptime monitors.
// Restrict behind auth here if you do not want this exposed in production.
export async function GET() {
  const health = await checkRedisHealth();

  return NextResponse.json(
    {
      status: health.ok ? 'ok' : 'error',
      latencyMs: health.latencyMs,
      ...(health.error ? { error: health.error } : {}),
    },
    { status: health.ok ? 200 : 503 }
  );
}
