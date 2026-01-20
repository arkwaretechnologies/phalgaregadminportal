import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { Registration } from '@/types';
import { sendStatusUpdateEmail } from '@/lib/email';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

async function getNextBatchNumber(confcode: string): Promise<number> {
  // Get the highest batch number for THIS conference
  // Each conference has its own batch number sequence (1, 2, 3...)
  const { data, error } = await supabase
    .from('regh')
    .select('batchnum')
    .eq('confcode', confcode)
    .not('batchnum', 'is', null)
    .order('batchnum', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching max batch number:', error);
    return 1;
  }

  if (!data || data.length === 0 || !data[0]?.batchnum) {
    // No registrations with batch numbers for this conference yet, start at 1
    return 1;
  }

  // Return next batch number
  return (data[0].batchnum as number) + 1;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const confcode = searchParams.get('confcode');

    let query = supabase
      .from('regh')
      .select('*, upload_notification(proof_uploaded_at, last_viewed_at)')
      .order('regdate', { ascending: false });

    // Filter by conference code
    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    // Filter by status (convert to uppercase for consistency)
    if (status && status !== 'all') {
      query = query.eq('status', status.toUpperCase());
    }

    // Search functionality
    if (search) {
      query = query.or(
        `regid.ilike.%${search}%,email.ilike.%${search}%,contactperson.ilike.%${search}%`
      );
    }

    const { data: registrations, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch registrations' },
        { status: 500 }
      );
    }

    // Auto-reject registrations that have passed 24 hours and are still PENDING
    const now = new Date();
    const processedRegistrations = await Promise.all(
      (registrations || []).map(async (reg: any) => {
        // Normalize status to uppercase for comparison
        const regStatus = reg.status?.toUpperCase() || null;
        
        if (regStatus === 'PENDING' && reg.regdate) {
          const registrationTime = new Date(reg.regdate).getTime();
          const deadline = registrationTime + 24 * 60 * 60 * 1000; // 24 hours
          
          if (now.getTime() > deadline) {
            // Auto-reject expired registrations
            // Only update if still PENDING to avoid race conditions
            try {
              const rejectionRemarks = 'We regret to inform you that your submission expired and rejected.';
              
              const { data: updatedRegs, error: updateError } = await supabase
                .from('regh')
                .update({
                  status: 'REJECTED',
                  remarks: rejectionRemarks,
                })
                .eq('regnum', reg.regnum)
                .eq('status', 'PENDING') // Only update if still PENDING to prevent loops
                .select();

              if (updateError) {
                console.error(`Failed to auto-reject registration ${reg.regnum}:`, updateError);
                return reg;
              }

              if (updatedRegs && updatedRegs.length > 0) {
                const autoRejectedReg = updatedRegs[0];
                // Send email notification for auto-rejection (non-blocking)
                console.log(`[AUTO-REJECT] Sending email for expired registration ${autoRejectedReg.regnum}`);
                sendStatusUpdateEmail({
                  registration: autoRejectedReg as Registration,
                  status: 'REJECTED',
                  remarks: rejectionRemarks,
                })
                  .then((success) => {
                    if (success) {
                      console.log(`[AUTO-REJECT] Email sent successfully for registration ${autoRejectedReg.regnum}`);
                    } else {
                      console.error(`[AUTO-REJECT] Failed to send email for registration ${autoRejectedReg.regnum}`);
                    }
                  })
                  .catch((emailError) => {
                    console.error(`[AUTO-REJECT] Exception sending email for registration ${autoRejectedReg.regnum}:`, emailError);
                  });
                return autoRejectedReg;
              }
            } catch (err) {
              console.error(`Failed to auto-reject registration ${reg.regnum}:`, err);
            }
          }
        }
        return reg;
      })
    );

    // Attach participant counts from regD (per regid) for display in the table.
    // regd rows are linked to regh by regid, not batchnum.
    const regids = (processedRegistrations || [])
      .map((r: any) => r?.regid)
      .filter((id: any) => id != null && id !== '');

    const countsByRegid = new Map<string, number>();

    if (regids.length > 0) {
      const queryRegids = regids.map((id: any) => String(id).trim());
      const CHUNK_SIZE = 100;
      for (let i = 0; i < queryRegids.length; i += CHUNK_SIZE) {
        const chunk = queryRegids.slice(i, i + CHUNK_SIZE);
        const { data: regdRows, error: regdError } = await supabase
          .from('regd')
          .select('regid')
          .in('regid', chunk);

        if (regdError) {
          console.error('Database error (regd count by regid):', regdError);
          continue;
        }

        for (const row of regdRows || []) {
          const rawId = (row as any)?.regid;
          if (rawId == null) continue;
          const regidStr = String(rawId).trim();
          countsByRegid.set(regidStr, (countsByRegid.get(regidStr) || 0) + 1);
        }
      }
    }

    const finalRegistrations = (processedRegistrations || []).map((r: any) => {
      const regidStr = r?.regid ? String(r.regid).trim() : null;
      const notification = Array.isArray(r.upload_notification)
        ? r.upload_notification[0]
        : r.upload_notification;

      return {
        ...r,
        participant_count: regidStr ? (countsByRegid.get(regidStr) || 0) : 0,
        proof_uploaded_at: notification?.proof_uploaded_at || null,
        last_viewed_at: notification?.last_viewed_at || null,
        upload_notification: undefined,
      };
    });

    return NextResponse.json({ registrations: finalRegistrations });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Registrations fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const body = await request.json();
    const { regid, batchnum, regnum, status, remarks } = body;

    // Validate input
    if ((!regid && !batchnum && !regnum) || !status) {
      return NextResponse.json(
        { error: 'Registration identifier and status are required' },
        { status: 400 }
      );
    }

    // Convert status to uppercase
    const statusUpper = status.toUpperCase();
    
    if (!['APPROVED', 'REJECTED'].includes(statusUpper)) {
      return NextResponse.json(
        { error: 'Status must be either APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    if (statusUpper === 'REJECTED' && !remarks) {
      return NextResponse.json(
        { error: 'Remarks are required when rejecting a registration' },
        { status: 400 }
      );
    }

    // Find the registration first (we need confcode + existing batchnum for batch generation)
    let findQuery = supabase.from('regh').select('*');
    if (regid) {
      findQuery = findQuery.eq('regid', String(regid));
    } else if (batchnum != null) {
      const batchnumInt = typeof batchnum === 'string' ? parseInt(batchnum, 10) : batchnum;
      if (isNaN(batchnumInt)) {
        return NextResponse.json({ error: 'Invalid batch number' }, { status: 400 });
      }
      findQuery = findQuery.eq('batchnum', batchnumInt);
    } else {
      const regnumInt = typeof regnum === 'string' ? parseInt(regnum, 10) : regnum;
      if (isNaN(regnumInt)) {
        return NextResponse.json({ error: 'Invalid registration number' }, { status: 400 });
      }
      findQuery = findQuery.eq('regnum', regnumInt);
    }

    const { data: existingRegs, error: findError } = await findQuery.maybeSingle();

    if (findError || !existingRegs) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Prepare update payload
    const updateData: any = {
      status: statusUpper,
      remarks: remarks || null,
    };

    // If approving, generate batch number based on conference (per-confcode sequence)
    if (statusUpper === 'APPROVED') {
      if (!existingRegs.batchnum) {
        if (existingRegs.confcode) {
          updateData._needsBatchNum = true;
          updateData._confcode = existingRegs.confcode;
        } else {
          console.warn('Cannot generate batch number: registration has no confcode');
        }
      }
    } else if (statusUpper === 'REJECTED') {
      // When rejecting, clear batch number if it exists
      updateData.batchnum = null;
    }

    // Build identifier for update (prefer regid; batchnum isn't globally unique)
    const updateIdentifier =
      existingRegs.regid ? { field: 'regid', value: existingRegs.regid as string } : null;
    if (!updateIdentifier) {
      return NextResponse.json({ error: 'Cannot update registration: missing regid' }, { status: 400 });
    }

    const needsBatchNum = updateData._needsBatchNum;
    const confcodeForBatch = updateData._confcode;
    delete updateData._needsBatchNum;
    delete updateData._confcode;

    let data: any[] | null = null;
    let error: any = null;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (needsBatchNum && confcodeForBatch) {
        try {
          const nextBatchNum = await getNextBatchNumber(confcodeForBatch);
          updateData.batchnum = nextBatchNum;
        } catch (err) {
          console.error('Error generating batch number:', err);
        }
      }

      const updateQuery = supabase
        .from('regh')
        .update(updateData)
        .eq(updateIdentifier.field, updateIdentifier.value);

      const result = await updateQuery.select();
      data = result.data;
      error = result.error;

      // Unique constraint violation (race): retry
      if (error && error.code === '23505') {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      break;
    }

    if (error) {
      console.error('Database error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Update data:', updateData);
      console.error('Lookup by:', { regid, batchnum, regnum });
      return NextResponse.json(
        { 
          error: 'Failed to update registration',
          details: error.message || 'Unknown database error',
          code: error.code
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          error: 'Registration found but could not be updated. This may be due to Row Level Security (RLS) policies.',
          details: 'Please check RLS policies on the regh table'
        },
        { status: 403 }
      );
    }

    // Return the first (and should be only) updated record
    const updatedRegistration = data[0];

    // If batchnum was set, also update regd rows to have the batchnum (keeps reports consistent)
    if (statusUpper === 'APPROVED' && updateData.batchnum && existingRegs.regid) {
      try {
        await supabase
          .from('regd')
          .update({ batchnum: updateData.batchnum })
          .eq('regid', existingRegs.regid);
      } catch (err) {
        console.warn('Failed to update regd rows with batchnum:', err);
      }
    } else if (statusUpper === 'REJECTED' && existingRegs.regid) {
      try {
        await supabase
          .from('regd')
          .update({ batchnum: null })
          .eq('regid', existingRegs.regid);
      } catch (err) {
        console.warn('Failed to clear batchnum from regd rows:', err);
      }
    }

    // Send email notification to participant (non-blocking)
    // Don't fail the request if email sending fails
    console.log('[API] Preparing to send email notification...');
    sendStatusUpdateEmail({
      registration: updatedRegistration as Registration,
      status: statusUpper as 'APPROVED' | 'REJECTED',
      remarks: remarks || null,
    })
      .then((success) => {
        if (success) {
          console.log('[API] Email notification sent successfully');
        } else {
          console.error('[API] Email notification failed (check logs above)');
        }
      })
      .catch((emailError) => {
        console.error('[API] Exception caught while sending email:', emailError);
        console.error('[API] Email error stack:', emailError instanceof Error ? emailError.stack : 'No stack trace');
      });

    return NextResponse.json({ registration: updatedRegistration });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Registration update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


