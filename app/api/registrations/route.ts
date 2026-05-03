import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getParticipantCountsByRegids } from '@/lib/regd-participant-counts';
import { requireAuth } from '@/lib/auth';
import { Registration } from '@/types';
import { sendStatusUpdateEmail } from '@/lib/email';
import {
  APPROVED_PARTICIPANT_AND_ACCOMPANYING,
  APPROVED_STATUS_VALUES,
} from '@/lib/registration-status';

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
    const withAttachment = searchParams.get('withAttachment');

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
      const su = status.toUpperCase();
      if (su === 'APPROVED') {
        query = query.in('status', [...APPROVED_STATUS_VALUES]);
      } else {
        query = query.eq('status', su);
      }
    }

    // Search functionality - search in regh fields
    if (search) {
      query = query.or(
        `regid.ilike.%${search}%,email.ilike.%${search}%,contactperson.ilike.%${search}%`
      );
    }

    const { data: registrations, error } = await query;

    // If search term is provided, also search for participant names in regd table
    // and merge those registrations into the results
    let additionalRegids: string[] = [];
    if (search && !error) {
      const searchTerm = search.trim();
      const searchParts = searchTerm.split(/\s+/).filter(Boolean);
      
      // Collect all matching regids from different search strategies
      const matchingRegids = new Set<string>();
      
      // Strategy 1: Search the exact term in firstname or lastname
      let query1 = supabase
        .from('regd')
        .select('regid')
        .or(`firstname.ilike.%${searchTerm}%,lastname.ilike.%${searchTerm}%`);
      
      if (confcode) {
        query1 = query1.eq('confcode', confcode);
      }
      
      const { data: matches1 } = await query1;
      matches1?.forEach((r: any) => r.regid && matchingRegids.add(r.regid));
      
      // Strategy 2: For multi-word searches, try firstname contains first word AND lastname contains last word
      // This handles full name searches like "Juan Dela Cruz" where firstname="Juan" and lastname="Dela Cruz"
      if (searchParts.length >= 2) {
        const firstWord = searchParts[0];
        const lastWord = searchParts[searchParts.length - 1];
        
        let query2 = supabase
          .from('regd')
          .select('regid')
          .ilike('firstname', `%${firstWord}%`)
          .ilike('lastname', `%${lastWord}%`);
        
        if (confcode) {
          query2 = query2.eq('confcode', confcode);
        }
        
        const { data: matches2 } = await query2;
        matches2?.forEach((r: any) => r.regid && matchingRegids.add(r.regid));
        
        // Strategy 3: Also try the reverse - last word in firstname, first word in lastname
        // This handles cases where names might be entered in different orders
        let query3 = supabase
          .from('regd')
          .select('regid')
          .ilike('firstname', `%${lastWord}%`)
          .ilike('lastname', `%${firstWord}%`);
        
        if (confcode) {
          query3 = query3.eq('confcode', confcode);
        }
        
        const { data: matches3 } = await query3;
        matches3?.forEach((r: any) => r.regid && matchingRegids.add(r.regid));
      }
      
      // Convert Set to array and filter out regids already in the results
      const existingRegids = new Set((registrations || []).map((r: any) => r.regid));
      additionalRegids = Array.from(matchingRegids).filter(regid => !existingRegids.has(regid));
    }

    // Fetch additional registrations that match participant names
    let allRegistrations = registrations || [];
    if (additionalRegids.length > 0) {
      let additionalQuery = supabase
        .from('regh')
        .select('*, upload_notification(proof_uploaded_at, last_viewed_at)')
        .in('regid', additionalRegids)
        .order('regdate', { ascending: false });

      // Apply status filter if specified
      if (status && status !== 'all') {
        const su = status.toUpperCase();
        if (su === 'APPROVED') {
          additionalQuery = additionalQuery.in('status', [...APPROVED_STATUS_VALUES]);
        } else {
          additionalQuery = additionalQuery.eq('status', su);
        }
      }

      const { data: additionalRegs, error: additionalError } = await additionalQuery;
      
      if (!additionalError && additionalRegs) {
        allRegistrations = [...allRegistrations, ...additionalRegs];
      }
    }

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch registrations' },
        { status: 500 }
      );
    }

    const countsByRegid = await getParticipantCountsByRegids(
      supabase,
      (allRegistrations || []).map((r: any) => r?.regid)
    );

    let finalRegistrations = (allRegistrations || []).map((r: any) => {
      const regid = r?.regid;
      const regidKey = regid ? String(regid).trim() : null;
      const notification = Array.isArray(r.upload_notification)
        ? r.upload_notification[0]
        : r.upload_notification;

      return {
        ...r,
        participant_count: regidKey ? (countsByRegid.get(regidKey) || 0) : 0,
        proof_uploaded_at: notification?.proof_uploaded_at || null,
        last_viewed_at: notification?.last_viewed_at || null,
        upload_notification: undefined,
      };
    });

    // Filter to only submissions with attached file (payment proof) when requested
    if (withAttachment === 'true' || withAttachment === '1') {
      finalRegistrations = finalRegistrations.filter(
        (r: any) => r.proof_uploaded_at != null && r.proof_uploaded_at !== ''
      );
    }

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

    let storedStatus = statusUpper;
    if (statusUpper === 'APPROVED' && existingRegs.confcode) {
      const { data: confForAward } = await supabase
        .from('conference')
        .select('is_award')
        .eq('confcode', existingRegs.confcode)
        .maybeSingle();
      const isAward = String(confForAward?.is_award ?? '').toUpperCase() === 'Y';
      if (isAward) {
        storedStatus = APPROVED_PARTICIPANT_AND_ACCOMPANYING;
      }
    }

    // Prepare update payload
    const updateData: any = {
      status: storedStatus,
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
    
    // Fetch conference information if confcode exists
    let conferenceInfo: {
      name: string | null;
      domain: string | null;
      venue: string | null;
      date_from: string | null;
      date_to: string | null;
      is_anc?: string | null;
    } | null = null;
    
    if (updatedRegistration.confcode) {
      try {
        const { data: conference, error: confError } = await supabase
          .from('conference')
          .select('name, domain, venue, date_from, date_to, is_anc')
          .eq('confcode', updatedRegistration.confcode)
          .single();
        
        if (!confError && conference) {
          conferenceInfo = conference;
        }
      } catch (err) {
        console.warn('[API] Failed to fetch conference info for email:', err);
      }
    }
    
    const emailStatus: 'APPROVED' | 'REJECTED' =
      statusUpper === 'REJECTED' ? 'REJECTED' : 'APPROVED';

    let conferenceContactNumbers: string[] | null = null;
    let participantCountForEmail: number | null = null;
    if (
      updatedRegistration.status === APPROVED_PARTICIPANT_AND_ACCOMPANYING &&
      updatedRegistration.confcode &&
      updatedRegistration.regid
    ) {
      try {
        const { data: contactRows } = await supabase
          .from('contacts')
          .select('contact_no')
          .eq('confcode', updatedRegistration.confcode)
          .order('id', { ascending: true });
        const nums =
          contactRows?.map((c: { contact_no: string | null }) => c.contact_no).filter(Boolean) ??
          [];
        conferenceContactNumbers = nums.length ? (nums as string[]) : null;
      } catch (err) {
        console.warn('[API] Failed to fetch contacts for award confirmation email:', err);
      }
      try {
        const { count, error: cntErr } = await supabase
          .from('regd')
          .select('*', { count: 'exact', head: true })
          .eq('regid', updatedRegistration.regid);
        if (!cntErr && count != null) {
          participantCountForEmail = count;
        }
      } catch (err) {
        console.warn('[API] Failed to count participants for award confirmation email:', err);
      }
    }

    sendStatusUpdateEmail({
      registration: updatedRegistration as Registration,
      status: emailStatus,
      remarks: remarks || null,
      conferenceName: conferenceInfo?.name || null,
      conferenceDomain: conferenceInfo?.domain || null,
      conferenceVenue: conferenceInfo?.venue || null,
      conferenceDateFrom: conferenceInfo?.date_from || null,
      conferenceDateTo: conferenceInfo?.date_to || null,
      conferenceIsAnc: conferenceInfo?.is_anc || null,
      conferenceContactNumbers,
      participantCount: participantCountForEmail,
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


