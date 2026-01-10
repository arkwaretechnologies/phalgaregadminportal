import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type ConfigKey = 'PROVINCE_LGU_LIMIT' | 'REGISTRATION_LIMIT' | 'REGISTRATION_DEADLINE';

const KNOWN_KEYS: ConfigKey[] = [
  'PROVINCE_LGU_LIMIT',
  'REGISTRATION_LIMIT',
  'REGISTRATION_DEADLINE',
];

function normalizeOptionalInt(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    throw new Error('InvalidNumber');
  }
  return String(num);
}

function normalizeOptionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('InvalidDate');
  // Accept either ISO string or datetime-local string; store as ISO if parseable.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('InvalidDate');
  return d.toISOString();
}

export async function GET() {
  try {
    await requireAuth(['admin']);

    const { data, error } = await supabase
      .from('config')
      .select('paramname, paramvalue');

    if (error) {
      console.error('Config fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    const map: Record<string, string | null> = {};
    for (const row of data || []) {
      if (!row?.paramname) continue;
      map[row.paramname] = row.paramvalue ?? null;
    }

    // Ensure known keys always exist in response (even if missing in DB)
    for (const k of KNOWN_KEYS) {
      if (!(k in map)) map[k] = null;
    }

    return NextResponse.json({ config: map });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth(['admin']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const municipalityLimit = normalizeOptionalInt((body as any).PROVINCE_LGU_LIMIT);
    const registrationLimit = normalizeOptionalInt((body as any).REGISTRATION_LIMIT);
    const deadlineIso = normalizeOptionalDate((body as any).REGISTRATION_DEADLINE);

    // Your existing config table may not have a UNIQUE constraint on paramname,
    // so we avoid UPSERT (ON CONFLICT) and do update-then-insert.
    const updates: Array<{ paramname: ConfigKey; paramvalue: string | null }> = [
      { paramname: 'PROVINCE_LGU_LIMIT', paramvalue: municipalityLimit },
      { paramname: 'REGISTRATION_LIMIT', paramvalue: registrationLimit },
      { paramname: 'REGISTRATION_DEADLINE', paramvalue: deadlineIso },
    ];

    for (const u of updates) {
      const { data: updated, error: updateError } = await supabase
        .from('config')
        .update({ paramvalue: u.paramvalue })
        .eq('paramname', u.paramname)
        .select('paramname');

      if (updateError) {
        console.error('Config update error:', updateError);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
      }

      // If no row existed, insert a new one
      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase
          .from('config')
          .insert({ paramname: u.paramname, paramvalue: u.paramvalue });

        if (insertError) {
          console.error('Config insert error:', insertError);
          return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'InvalidNumber') {
      return NextResponse.json(
        { error: 'Limits must be whole numbers (0 or higher).' },
        { status: 400 }
      );
    }
    if (error.message === 'InvalidDate') {
      return NextResponse.json(
        { error: 'Deadline must be a valid date/time.' },
        { status: 400 }
      );
    }
    console.error('Config PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

