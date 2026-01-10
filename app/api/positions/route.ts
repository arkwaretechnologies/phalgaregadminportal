import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth(['admin']);

    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Positions fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
    }

    return NextResponse.json({ positions: data || [] });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Positions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(['admin']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name } = body as { name?: string };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Position name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if position with this name already exists
    const { data: existing } = await supabase
      .from('positions')
      .select('position_id')
      .eq('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Position with this name already exists' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('positions')
      .insert({ name: trimmedName })
      .select()
      .single();

    if (error) {
      console.error('Position insert error:', error);
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Position with this name already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create position' }, { status: 500 });
    }

    return NextResponse.json({ position: data }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Position POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
