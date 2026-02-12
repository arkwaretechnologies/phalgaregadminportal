import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Helper function to fetch all records without Supabase's default 1000 row limit
async function fetchAllRecords(
  table: string,
  queryBuilder: (query: any) => any,
  pageSize: number = 1000
): Promise<{ data: any[]; error: any }> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select('*');
    query = queryBuilder(query);
    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      return { data: [], error };
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, error: null };
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const searchParams = request.nextUrl.searchParams;
    const confcode = searchParams.get('confcode');
    const view = searchParams.get('view') || 'registration'; // 'registration' or 'participant'

    // Fetch all pending registrations
    const { data: pendingRegistrations, error: regError } = await fetchAllRecords(
      'regh',
      (query) => {
        query = query.eq('status', 'PENDING').order('regdate', { ascending: false });
        if (confcode) {
          query = query.eq('confcode', confcode);
        }
        return query;
      }
    );

    if (regError) {
      console.error('Error fetching pending registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch pending registrations' },
        { status: 500 }
      );
    }

    const regids = (pendingRegistrations || []).map((r: any) => r?.regid).filter((id: any) => id);

    // Fetch all participants for these pending registrations
    let allParticipants: any[] = [];
    if (regids.length > 0) {
      const { data: regdRows, error: regdError } = await fetchAllRecords(
        'regd',
        (query) => {
          return query
            .in('regid', regids)
            .order('regid', { ascending: true })
            .order('linenum', { ascending: true });
        }
      );

      if (regdError) {
        console.error('Error fetching participants:', regdError);
      } else {
        allParticipants = regdRows || [];
      }
    }

    // Always compute both summary counts
    const totalRegistrations = (pendingRegistrations || []).length;
    const totalParticipants = allParticipants.length;

    if (view === 'participant') {
      // Return flat list of all pending participants with their registration info
      const participantsWithRegInfo = allParticipants.map((participant: any) => {
        const registration = (pendingRegistrations || []).find((r: any) => r.regid === participant.regid);
        return {
          ...participant,
          registration: registration ? {
            regid: registration.regid,
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
        view: 'participant',
        participants: participantsWithRegInfo,
        total: participantsWithRegInfo.length,
        totalRegistrations,
        totalParticipants,
      });
    }

    // Default: return all pending registrations with participant counts
    const participantCountMap: Record<string, number> = {};
    allParticipants.forEach((p: any) => {
      const regid = p.regid;
      if (regid) {
        participantCountMap[regid] = (participantCountMap[regid] || 0) + 1;
      }
    });

    const registrationsWithCount = (pendingRegistrations || []).map((reg: any) => ({
      regid: reg.regid,
      confcode: reg.confcode,
      province: reg.province,
      lgu: reg.lgu,
      contactperson: reg.contactperson,
      contactnum: reg.contactnum,
      email: reg.email,
      regdate: reg.regdate,
      participantCount: participantCountMap[reg.regid] || 0,
    }));

    return NextResponse.json({
      view: 'registration',
      registrations: registrationsWithCount,
      total: registrationsWithCount.length,
      totalRegistrations,
      totalParticipants,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching pending report:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
