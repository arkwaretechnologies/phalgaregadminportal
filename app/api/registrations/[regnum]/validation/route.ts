import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';
import { isApprovedStatus } from '@/lib/registration-status';
import { invalidateReportCacheForConference } from '@/lib/redis';

export const dynamic = 'force-dynamic';

function isValidatingFlag(value: string | null | undefined): boolean {
  return String(value ?? '').trim().toUpperCase() === 'Y';
}

async function resolveRegistration(regnum: string) {
  const decodedRegnum = decodeURIComponent(regnum);

  const { data: regById, error: errorById } = await supabaseServer
    .from('regh')
    .select('regid, confcode, status, is_validating, validation_no')
    .eq('regid', decodedRegnum)
    .maybeSingle();

  if (!errorById && regById) {
    return regById;
  }

  const batchnum = parseInt(regnum, 10);
  const isNumeric = !Number.isNaN(batchnum) && /^\d+$/.test(regnum);

  if (isNumeric) {
    const { data: regByBatch, error: errorByBatch } = await supabaseServer
      .from('regh')
      .select('regid, confcode, status, is_validating, validation_no')
      .eq('batchnum', batchnum)
      .maybeSingle();

    if (!errorByBatch && regByBatch) {
      return regByBatch;
    }
  }

  return null;
}

async function nextValidationNo(confcode: string): Promise<number> {
  const { data, error } = await supabaseServer
    .from('regh')
    .select('validation_no')
    .eq('confcode', confcode)
    .not('validation_no', 'is', null)
    .order('validation_no', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[validation] Failed to fetch max validation_no:', error);
    throw new Error('Failed to assign validation number');
  }

  const max = data?.[0]?.validation_no;
  const n = typeof max === 'number' ? max : Number(max);
  return Number.isFinite(n) && n > 0 ? n + 1 : 1;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof (body as any).on_validation !== 'boolean') {
      return NextResponse.json(
        { error: 'on_validation (boolean) is required' },
        { status: 400 }
      );
    }

    const onValidation = (body as { on_validation: boolean }).on_validation;
    const registration = await resolveRegistration(params.regnum);

    if (!registration?.regid) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (isApprovedStatus(registration.status) || registration.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Cannot toggle validation on approved or rejected registrations' },
        { status: 400 }
      );
    }

    const alreadyValidating = isValidatingFlag(registration.is_validating);

    if (onValidation && alreadyValidating) {
      return NextResponse.json({
        registration: {
          regid: registration.regid,
          is_validating: 'Y',
          validation_no: registration.validation_no ?? null,
        },
      });
    }

    if (!onValidation && !alreadyValidating) {
      return NextResponse.json({
        registration: {
          regid: registration.regid,
          is_validating: 'N',
          validation_no: null,
        },
      });
    }

    let updateData: { is_validating: string; validation_no: number | null };

    if (onValidation) {
      const confcode = String(registration.confcode ?? '').trim();
      if (!confcode) {
        return NextResponse.json(
          { error: 'Registration has no conference code; cannot assign validation number' },
          { status: 400 }
        );
      }
      const validationNo = await nextValidationNo(confcode);
      updateData = { is_validating: 'Y', validation_no: validationNo };
    } else {
      updateData = { is_validating: 'N', validation_no: null };
    }

    const { data: updated, error: updateError } = await supabaseServer
      .from('regh')
      .update(updateData)
      .eq('regid', registration.regid)
      .select('regid, is_validating, validation_no, confcode')
      .single();

    if (updateError || !updated) {
      console.error('[validation] Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update validation state' },
        { status: 500 }
      );
    }

    const confcode = String(updated.confcode ?? registration.confcode ?? '').trim();
    if (confcode) {
      void invalidateReportCacheForConference(confcode).catch((err) => {
        console.error('[validation] Failed to invalidate report cache:', err);
      });
    }

    return NextResponse.json({
      registration: {
        regid: updated.regid,
        is_validating: updated.is_validating,
        validation_no: updated.validation_no,
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[validation] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
