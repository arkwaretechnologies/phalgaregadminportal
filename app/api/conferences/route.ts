import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check authentication - allow admin and reviewer to view conferences
    await requireAuth(['admin', 'reviewer']);

    const { data: conferences, error } = await supabase
      .from('conference')
      .select('*')
      .order('confcode', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ conferences: conferences || [] });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Conferences fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function normalizeOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
    throw new Error('InvalidNumber');
  }
  return num;
}

function normalizeOptionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('InvalidDate');
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('InvalidDate');
  // Return as ISO date string (YYYY-MM-DD format)
  return d.toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { confcode, name, date_from, date_to, venue, reg_limit, domain } = body as any;

    // Validate confcode is required
    if (!confcode || typeof confcode !== 'string' || confcode.trim() === '') {
      return NextResponse.json(
        { error: 'Conference code is required' },
        { status: 400 }
      );
    }

    // Check if confcode already exists
    const { data: existingConference } = await supabase
      .from('conference')
      .select('confcode')
      .eq('confcode', confcode.trim())
      .single();

    if (existingConference) {
      return NextResponse.json(
        { error: 'Conference code already exists' },
        { status: 400 }
      );
    }

    // Validate and normalize optional fields
    let normalizedRegLimit: number | null = null;
    try {
      normalizedRegLimit = normalizeOptionalInt(reg_limit);
    } catch (e: any) {
      if (e.message === 'InvalidNumber') {
        return NextResponse.json(
          { error: 'Registration limit must be a positive whole number' },
          { status: 400 }
        );
      }
    }

    let normalizedDateFrom: string | null = null;
    let normalizedDateTo: string | null = null;
    try {
      normalizedDateFrom = normalizeOptionalDate(date_from);
      normalizedDateTo = normalizeOptionalDate(date_to);
    } catch (e: any) {
      if (e.message === 'InvalidDate') {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }
    }

    // Validate date_to is after date_from if both provided
    if (normalizedDateFrom && normalizedDateTo) {
      const fromDate = new Date(normalizedDateFrom);
      const toDate = new Date(normalizedDateTo);
      if (toDate < fromDate) {
        return NextResponse.json(
          { error: 'End date must be after or equal to start date' },
          { status: 400 }
        );
      }
    }

    // Build insert object
    const insertData: any = {
      confcode: confcode.trim(),
      name: name && typeof name === 'string' ? name.trim() || null : null,
      date_from: normalizedDateFrom,
      date_to: normalizedDateTo,
      venue: venue && typeof venue === 'string' ? venue.trim() || null : null,
      reg_limit: normalizedRegLimit,
      domain: domain && typeof domain === 'string' ? domain.trim() || null : null,
    };

    // Create conference
    const { data: conference, error } = await supabase
      .from('conference')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create conference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ conference }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Conference creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
