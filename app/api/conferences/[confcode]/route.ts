import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { confcode: string } }
) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    const confcode = decodeURIComponent(params.confcode);

    if (!confcode || confcode.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid conference code' },
        { status: 400 }
      );
    }

    // Check if conference exists
    const { data: existingConference } = await supabase
      .from('conference')
      .select('confcode')
      .eq('confcode', confcode)
      .single();

    if (!existingConference) {
      return NextResponse.json(
        { error: 'Conference not found' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { confcode: newConfcode, name, date_from, date_to, venue, reg_limit, domain } = body as any;

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

    // Handle confcode update if provided and different
    let finalConfcode = confcode;
    if (newConfcode !== undefined && typeof newConfcode === 'string') {
      const trimmedNewConfcode = newConfcode.trim();
      if (!trimmedNewConfcode) {
        return NextResponse.json(
          { error: 'Conference code cannot be empty' },
          { status: 400 }
        );
      }
      if (trimmedNewConfcode !== confcode) {
        // Check if new confcode already exists
        const { data: existingWithNewCode } = await supabase
          .from('conference')
          .select('confcode')
          .eq('confcode', trimmedNewConfcode)
          .single();
        
        if (existingWithNewCode) {
          return NextResponse.json(
            { error: 'Conference code already exists' },
            { status: 400 }
          );
        }
        finalConfcode = trimmedNewConfcode;
      }
    }

    // Build update object
    const updateData: any = {};

    // If confcode is changing, include it in the update
    if (finalConfcode !== confcode) {
      updateData.confcode = finalConfcode;
    }

    if (name !== undefined) {
      updateData.name = name && typeof name === 'string' ? name.trim() || null : null;
    }
    if (date_from !== undefined) {
      updateData.date_from = normalizedDateFrom;
    }
    if (date_to !== undefined) {
      updateData.date_to = normalizedDateTo;
    }
    if (venue !== undefined) {
      updateData.venue = venue && typeof venue === 'string' ? venue.trim() || null : null;
    }
    if (reg_limit !== undefined) {
      updateData.reg_limit = normalizedRegLimit;
    }
    if (domain !== undefined) {
      updateData.domain = domain && typeof domain === 'string' ? domain.trim() || null : null;
    }

    // Update conference
    const { data: conference, error } = await supabase
      .from('conference')
      .update(updateData)
      .eq('confcode', confcode)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update conference' },
        { status: 500 }
      );
    }

    if (!conference) {
      return NextResponse.json(
        { error: 'Conference not found' },
        { status: 404 }
      );
    }

    // If confcode changed, update foreign key references in regh and regd tables
    // Note: If foreign keys have ON UPDATE CASCADE, this might not be necessary,
    // but we do it explicitly to ensure data integrity
    if (finalConfcode !== confcode) {
      // Update regh table
      const { error: reghError } = await supabase
        .from('regh')
        .update({ confcode: finalConfcode })
        .eq('confcode', confcode);

      if (reghError) {
        console.error('Error updating regh table:', reghError);
        // Note: We don't fail the request here, but log the error
        // The conference update succeeded, but foreign key update failed
        // This could happen if foreign keys don't allow updates
      }

      // Update regd table
      const { error: regdError } = await supabase
        .from('regd')
        .update({ confcode: finalConfcode })
        .eq('confcode', confcode);

      if (regdError) {
        console.error('Error updating regd table:', regdError);
        // Note: We don't fail the request here, but log the error
      }
    }

    return NextResponse.json({ conference });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Conference update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { confcode: string } }
) {
  try {
    // Check authentication - admin only
    await requireAuth(['admin']);

    const confcode = decodeURIComponent(params.confcode);

    if (!confcode || confcode.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid conference code' },
        { status: 400 }
      );
    }

    // Check if conference exists
    const { data: existingConference } = await supabase
      .from('conference')
      .select('confcode')
      .eq('confcode', confcode)
      .single();

    if (!existingConference) {
      return NextResponse.json(
        { error: 'Conference not found' },
        { status: 404 }
      );
    }

    // Optionally check if any registrations exist with this confcode
    const { data: registrations } = await supabase
      .from('regh')
      .select('batchnum')
      .eq('confcode', confcode)
      .limit(1);

    if (registrations && registrations.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete conference with existing registrations' },
        { status: 400 }
      );
    }

    // Delete conference
    const { error } = await supabase
      .from('conference')
      .delete()
      .eq('confcode', confcode);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete conference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Conference deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Conference deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
