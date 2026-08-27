import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { invalidateReportCacheForConference } from '@/lib/redis';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { regnum: string; linenum: string } }
) {
  try {
    // Check authentication - allow admin and reviewer
    await requireAuth(['admin', 'reviewer']);

    const decodedRegnum = decodeURIComponent(params.regnum);
    const linenum = parseInt(params.linenum);

    if (isNaN(linenum)) {
      return NextResponse.json(
        { error: 'Invalid line number' },
        { status: 400 }
      );
    }

    const registration = await getRegistrationByRegnum(decodedRegnum);
    if (!registration?.regid) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Delete the participant from regd table
    const { error: deleteError, count } = await supabase
      .from('regd')
      .delete()
      .eq('regid', registration.regid)
      .eq('linenum', linenum);

    if (deleteError) {
      console.error('Error deleting participant:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete participant' },
        { status: 500 }
      );
    }

    if (registration.confcode) {
      void invalidateReportCacheForConference(String(registration.confcode)).catch((err) => {
        console.warn('[participant-delete] Failed to invalidate report cache:', err);
      });
    }

    return NextResponse.json({
      message: 'Participant deleted successfully',
      regid: registration.regid,
      linenum: linenum
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Participant deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getRegistrationByRegnum(decodedRegnum: string) {
  const { data: regById, error: errorById } = await supabase
    .from('regh')
    .select('regid, confcode')
    .eq('regid', decodedRegnum)
    .maybeSingle();

  if (!errorById && regById) return regById;

  const batchnum = parseInt(decodedRegnum, 10);
  if (!Number.isNaN(batchnum) && /^\d+$/.test(decodedRegnum)) {
    const { data: regByBatch, error: errorByBatch } = await supabase
      .from('regh')
      .select('regid, confcode')
      .eq('batchnum', batchnum)
      .maybeSingle();
    if (!errorByBatch && regByBatch) return regByBatch;
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { regnum: string; linenum: string } }
) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const decodedRegnum = decodeURIComponent(params.regnum);
    const linenum = parseInt(params.linenum);

    if (isNaN(linenum)) {
      return NextResponse.json(
        { error: 'Invalid line number' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const uppercaseFields = new Set([
      'lastname',
      'firstname',
      'middleinit',
      'suffix',
      'designation',
    ]);

    const normalizeOptionalString = (
      raw: unknown,
      uppercase = false
    ): string | null | undefined => {
      if (raw === undefined) return undefined;
      if (raw === null) return null;
      const trimmed = String(raw).trim();
      if (trimmed === '') return null;
      return uppercase ? trimmed.toUpperCase() : trimmed;
    };

    const updates: Record<string, string | null> = {};
    const fields = [
      'tshirtsize',
      'lastname',
      'firstname',
      'middleinit',
      'suffix',
      'designation',
      'food_preference',
    ] as const;

    for (const field of fields) {
      if (!(field in body)) continue;
      const value = normalizeOptionalString(
        (body as Record<string, unknown>)[field],
        uppercaseFields.has(field)
      );
      if (value !== undefined) {
        updates[field] = value;
      }
    }

    const isNameUpdate = [
      'lastname',
      'firstname',
      'middleinit',
      'suffix',
      'designation',
    ].some((field) => field in body);

    if (isNameUpdate) {
      if (!updates.lastname) {
        return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
      }
      if (!updates.firstname) {
        return NextResponse.json({ error: 'First name is required' }, { status: 400 });
      }
      if (!updates.designation) {
        return NextResponse.json({ error: 'Designation is required' }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error:
            'At least one of tshirtsize, lastname, firstname, middleinit, suffix, designation, or food_preference is required',
        },
        { status: 400 }
      );
    }

    const registration = await getRegistrationByRegnum(decodedRegnum);
    if (!registration?.regid) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from('regd')
      .update(updates)
      .eq('regid', registration.regid)
      .eq('linenum', linenum);

    if (updateError) {
      console.error('Error updating participant:', updateError);
      return NextResponse.json(
        { error: 'Failed to update participant' },
        { status: 500 }
      );
    }

    if (registration.confcode) {
      void invalidateReportCacheForConference(String(registration.confcode)).catch((err) => {
        console.warn('[participant-patch] Failed to invalidate report cache:', err);
      });
    }

    return NextResponse.json({
      message: 'Participant updated successfully',
      regid: registration.regid,
      linenum,
      ...updates,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Participant PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
