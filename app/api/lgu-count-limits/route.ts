import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface LguCountLimitRow {
  id: number;
  confcode: string | null;
  psgcode: string | null;
  geolevel: string | null;
  reg_limit: number | null;
  created_at: string;
}

/**
 * GET ?confcode= - list all lgu_count_limit rows for the conference
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin']);

    const { searchParams } = new URL(request.url);
    const confcode = searchParams.get('confcode')?.trim();
    if (!confcode) {
      return NextResponse.json(
        { error: 'confcode query parameter is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('lgu_count_limit')
      .select('id, confcode, psgcode, geolevel, reg_limit, created_at')
      .eq('confcode', confcode)
      .order('psgcode', { ascending: true });

    if (error) {
      console.error('lgu_count_limit fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch LGU count limits' },
        { status: 500 }
      );
    }

    return NextResponse.json({ limits: data || [] });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('lgu_count_limit GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - bulk upsert LGU limits for a conference.
 * Body: { confcode: string, limits: Array<{ psgcode: string, geolevel: string | null, reg_limit: number | null }> }
 * - If reg_limit is null/omitted, that LGU is "unlimited" (row removed if exists).
 * - Only rows with a numeric reg_limit are stored.
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth(['admin']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const confcode = (body as { confcode?: string }).confcode;
    const limits = (body as { limits?: unknown[] }).limits;

    if (!confcode || typeof confcode !== 'string' || !confcode.trim()) {
      return NextResponse.json(
        { error: 'confcode is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(limits)) {
      return NextResponse.json(
        { error: 'limits must be an array' },
        { status: 400 }
      );
    }

    const toInsert: Array<{
      confcode: string;
      psgcode: string | null;
      geolevel: string | null;
      reg_limit: number | null;
    }> = [];

    for (const item of limits) {
      if (!item || typeof item !== 'object') continue;
      const p = item as { psgcode?: string; geolevel?: string | null; reg_limit?: number | null };
      const psgcode =
        p.psgcode !== undefined && p.psgcode !== null
          ? String(p.psgcode).trim()
          : null;
      const regLimit = p.reg_limit;
      if (psgcode === null || psgcode === '') continue;
      if (regLimit !== null && regLimit !== undefined) {
        const num = Number(regLimit);
        if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) continue;
        toInsert.push({
          confcode: confcode.trim(),
          psgcode,
          geolevel:
            p.geolevel !== undefined && p.geolevel !== null
              ? String(p.geolevel).trim() || null
              : null,
          reg_limit: num,
        });
      }
    }

    const confcodeTrimmed = confcode.trim();

    const { error: deleteError } = await supabase
      .from('lgu_count_limit')
      .delete()
      .eq('confcode', confcodeTrimmed);

    if (deleteError) {
      console.error('lgu_count_limit delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to update LGU count limits' },
        { status: 500 }
      );
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('lgu_count_limit')
        .insert(toInsert);

      if (insertError) {
        console.error('lgu_count_limit insert error:', insertError);
        return NextResponse.json(
          { error: 'Failed to save LGU count limits' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('lgu_count_limit PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
