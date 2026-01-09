import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { Registration } from '@/types';
import { sendStatusUpdateEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let query = supabase
      .from('regh')
      .select('*')
      .order('regdate', { ascending: false });

    // Filter by status (convert to uppercase for consistency)
    if (status && status !== 'all') {
      query = query.eq('status', status.toUpperCase());
    }

    // Search functionality
    if (search) {
      query = query.or(
        `transid.ilike.%${search}%,email.ilike.%${search}%,contactperson.ilike.%${search}%`
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
            try {
              const rejectionRemarks = 'Sorry, We haven\'t received payment and the submission expired';
              
              const { data: updatedRegs, error: updateError } = await supabase
                .from('regh')
                .update({
                  status: 'REJECTED',
                  remarks: rejectionRemarks,
                })
                .eq('regnum', reg.regnum)
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

    return NextResponse.json({ registrations: processedRegistrations || [] });
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
    const { regnum, status, remarks } = body;

    // Validate input
    if (!regnum || !status) {
      return NextResponse.json(
        { error: 'Registration number and status are required' },
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

    // Ensure regnum is a number
    const regnumInt = typeof regnum === 'string' ? parseInt(regnum, 10) : regnum;
    
    if (isNaN(regnumInt)) {
      return NextResponse.json(
        { error: 'Invalid registration number' },
        { status: 400 }
      );
    }

    // Update registration
    const updateData: any = {
      status: statusUpper,
      remarks: remarks || null,
    };

    // Update the registration directly
    const { data, error } = await supabase
      .from('regh')
      .update(updateData)
      .eq('regnum', regnumInt)
      .select();

    if (error) {
      console.error('Database error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Update data:', updateData);
      console.error('Regnum:', regnumInt);
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


