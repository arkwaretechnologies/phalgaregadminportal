import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');

    // Build query for approved registrations
    let query = supabase
      .from('regh')
      .select('*')
      .eq('status', 'APPROVED')
      .order('regdate', { ascending: false });

    // Filter by conference code if provided
    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    const { data: approvedRegistrations, error: regError } = await query;

    if (regError) {
      console.error('Error fetching approved registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch approved registrations' },
        { status: 500 }
      );
    }

    // Get all regd rows for these registrations (by regid, not batchnum)
    const regids = (approvedRegistrations || []).map((r: any) => r?.regid).filter((id: any) => id);

    let allParticipants: any[] = [];

    if (regids.length > 0) {
      const { data: regdRows, error: regdError } = await supabase
        .from('regd')
        .select('*')
        .in('regid', regids)
        .order('regid', { ascending: true })
        .order('linenum', { ascending: true });

      if (regdError) {
        console.error('Error fetching participants:', regdError);
      } else {
        allParticipants = regdRows || [];
      }
    }

    // Combine registration info with participant details
    const participantsWithRegInfo = allParticipants.map((participant: any) => {
      const registration = (approvedRegistrations || []).find((r: any) => r.regid === participant.regid);
      return {
        ...participant,
        registration: registration ? {
          regid: registration.regid,
          batchnum: registration.batchnum,
          confcode: registration.confcode,
          province: registration.province,
          lgu: registration.lgu,
          contactperson: registration.contactperson,
          contactnum: registration.contactnum,
          email: registration.email,
          regdate: registration.regdate,
        } : null,
      };
    });

    return NextResponse.json({
      participants: participantsWithRegInfo,
      total: participantsWithRegInfo.length,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
