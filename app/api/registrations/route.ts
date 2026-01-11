import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { Registration } from '@/types';
import { sendStatusUpdateEmail } from '@/lib/email';

// Force dynamic rendering - this route uses Supabase
export const dynamic = 'force-dynamic';

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
      .select('*')
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

    // Attach participant counts from regD (per regid) for display in the table.
    // regd rows are linked to regh by regid, not batchnum (batchnum is only generated when approved).
    const regids = (registrations || [])
      .map((r: any) => r?.regid)
      .filter((id: any) => id != null && id !== '');

    const countsByRegid = new Map<string, number>();

    // Count participants by regid - fetch all rows to ensure we get accurate counts
    if (regids.length > 0) {
      // Use raw IDs for the query as they appear in regh
      const queryRegids = regids.map((id: any) => String(id).trim());
      
      // Chunk the request to avoid potential URL length limits if there are many IDs
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

    const registrationsWithCounts = (registrations || []).map((r: any) => {
      const regidStr = r?.regid ? String(r.regid).trim() : null;
      return {
        ...r,
        participant_count: regidStr ? (countsByRegid.get(regidStr) || 0) : 0,
      };
    });

    return NextResponse.json({ registrations: registrationsWithCounts });
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

export async function POST(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { regid, batchnum, status, remarks } = body;

    // Validate input - use regid as primary identifier if batchnum is not provided
    if (!regid && !batchnum) {
      return NextResponse.json(
        { error: 'Registration ID or batch number is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
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

    // Find the registration by regid or batchnum
    let query = supabase.from('regh').select('*');
    
    if (regid) {
      query = query.eq('regid', regid);
    } else if (batchnum) {
      const batchnumInt = typeof batchnum === 'string' ? parseInt(batchnum, 10) : batchnum;
      if (isNaN(batchnumInt)) {
        return NextResponse.json(
          { error: 'Invalid batch number' },
          { status: 400 }
        );
      }
      query = query.eq('batchnum', batchnumInt);
    }

    const { data: existingRegs, error: findError } = await query.maybeSingle();

    if (findError || !existingRegs) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // If approving, generate batch number based on conference
    const updateData: any = {
      status: statusUpper,
      remarks: remarks || null,
    };

    if (statusUpper === 'APPROVED') {
      // Only generate batch number if not already set
      if (!existingRegs.batchnum) {
        if (existingRegs.confcode) {
          // Will be generated with retry logic below
          updateData._needsBatchNum = true;
          updateData._confcode = existingRegs.confcode;
        } else {
          console.warn('Cannot generate batch number: registration has no confcode');
          // Continue without batch number
        }
      }
    } else {
      // When rejecting, clear batch number if it exists
      updateData.batchnum = null;
    }

    // Update the registration
    // Use the same identifier we used to find the registration
    let updateIdentifier: { field: string; value: string | number } | null = null;
    
    if (regid) {
      updateIdentifier = { field: 'regid', value: regid };
    } else if (batchnum) {
      const batchnumInt = typeof batchnum === 'string' ? parseInt(batchnum, 10) : batchnum;
      if (!isNaN(batchnumInt)) {
        updateIdentifier = { field: 'batchnum', value: batchnumInt };
      } else {
        return NextResponse.json(
          { error: 'Invalid batch number for update' },
          { status: 400 }
        );
      }
    } else {
      // Fallback: use regid from existingRegs if neither was provided
      if (existingRegs.regid) {
        updateIdentifier = { field: 'regid', value: existingRegs.regid };
      } else {
        return NextResponse.json(
          { error: 'Cannot update registration: no valid identifier' },
          { status: 400 }
        );
      }
    }

    // Handle batch number generation with retry logic for race conditions
    const needsBatchNum = updateData._needsBatchNum;
    const confcodeForBatch = updateData._confcode;
    delete updateData._needsBatchNum;
    delete updateData._confcode;

    let data: any[] | null = null;
    let error: any = null;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Generate batch number if needed
      if (needsBatchNum && confcodeForBatch) {
        try {
          const nextBatchNum = await getNextBatchNumber(confcodeForBatch);
          updateData.batchnum = nextBatchNum;
        } catch (err) {
          console.error('Error generating batch number:', err);
        }
      }

      // Build the update query
      const updateQuery = supabase
        .from('regh')
        .update(updateData)
        .eq(updateIdentifier.field, updateIdentifier.value);

      const result = await updateQuery.select();
      data = result.data;
      error = result.error;

      // Check for unique constraint violation (code 23505)
      if (error && error.code === '23505') {
        console.warn(`Batch number conflict (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`);
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }

      // No error or different error - exit retry loop
      break;
    }

    if (error) {
      console.error('Database error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Update data:', JSON.stringify(updateData, null, 2));
      console.error('Lookup by:', { regid, batchnum });
      console.error('Existing registration:', JSON.stringify(existingRegs, null, 2));
      return NextResponse.json(
        { 
          error: 'Failed to update registration: ' + (error.message || 'Unknown database error'),
          code: error.code,
          hint: error.hint || null
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

    // If batchnum was set, also update regd rows to have the batchnum
    // This ensures consistency even though regd is primarily linked by regid
    if (statusUpper === 'APPROVED' && updateData.batchnum && existingRegs.regid) {
      try {
        await supabase
          .from('regd')
          .update({ batchnum: updateData.batchnum })
          .eq('regid', existingRegs.regid);
        // Don't fail if this update fails - it's not critical since regd is linked by regid
      } catch (err) {
        console.warn('Failed to update regd rows with batchnum:', err);
      }
    } else if (statusUpper === 'REJECTED' && existingRegs.regid) {
      // Clear batchnum from regd rows when rejecting
      try {
        await supabase
          .from('regd')
          .update({ batchnum: null })
          .eq('regid', existingRegs.regid);
        // Don't fail if this update fails
      } catch (err) {
        console.warn('Failed to clear batchnum from regd rows:', err);
      }
    }

    // Fetch conference information for email
    let conferenceName: string | null = null;
    let conferenceDomain: string | null = null;
    if (updatedRegistration.confcode) {
      const { data: conference } = await supabase
        .from('conference')
        .select('name, domain')
        .eq('confcode', updatedRegistration.confcode)
        .maybeSingle();
      
      conferenceName = conference?.name || null;
      conferenceDomain = conference?.domain || null;
    }

    // Send email notification to participant (non-blocking)
    // Don't fail the request if email sending fails
    console.log('[API] Preparing to send email notification...');
    sendStatusUpdateEmail({
      registration: updatedRegistration as Registration,
      status: statusUpper as 'APPROVED' | 'REJECTED',
      remarks: remarks || null,
      conferenceName: conferenceName,
      conferenceDomain: conferenceDomain,
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


