import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getParticipantCountsByRegids } from '@/lib/regd-participant-counts';
import { Registration, User } from '@/types';
import RegistrationsPageClient from '@/components/RegistrationsPageClient';

// Force dynamic rendering - this page requires authentication and database access
export const dynamic = 'force-dynamic';

// Get conferences available to the user (filtered for reviewers)
async function getAvailableConferences(user: User): Promise<string[]> {
  if (user.role === 'reviewer') {
    // Get assigned conference codes for reviewer
    const { data: assignments } = await supabase
      .from('user_conferences')
      .select('confcode')
      .eq('user_id', user.user_id);
    
    return (assignments || []).map((a: { confcode: string }) => a.confcode);
  }
  
  // Admin can see all conferences
  const { data: conferences } = await supabase
    .from('conference')
    .select('confcode')
    .order('confcode', { ascending: true });
  
  return (conferences || []).map((c: { confcode: string }) => c.confcode);
}

async function getRegistrations(status: string = 'all', search: string = '', confcode: string | null = null): Promise<Registration[]> {
  try {
    let query = supabase
      .from('regh')
      .select('*, upload_notification(proof_uploaded_at, last_viewed_at)')
      .order('regdate', { ascending: false });

    if (confcode) {
      query = query.eq('confcode', confcode);
    }

    if (status !== 'all') {
      query = query.eq('status', status.toUpperCase());
    }

    if (search) {
      query = query.or(
        `regid.ilike.%${search}%,email.ilike.%${search}%,contactperson.ilike.%${search}%`
      );
    }

    const { data: registrations, error } = await query;

    if (error) {
      console.error('Error fetching registrations:', error);
      return [];
    }

    if (!registrations || registrations.length === 0) {
      return [];
    }

    const countsByRegid = await getParticipantCountsByRegids(
      supabase,
      (registrations || []).map((r: any) => r?.regid)
    );

    return (registrations || []).map((r: any) => {
      // Flatten the nested upload_notification structure
      const notification = Array.isArray(r.upload_notification) 
        ? r.upload_notification[0] 
        : r.upload_notification;
      
      return {
        ...r,
        participant_count: r.regid ? (countsByRegid.get(String(r.regid).trim()) || 0) : 0,
        proof_uploaded_at: notification?.proof_uploaded_at || null,
        last_viewed_at: notification?.last_viewed_at || null,
        // Remove the nested upload_notification object
        upload_notification: undefined,
      };
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return [];
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string; confcode?: string; openRegid?: string };
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const status = searchParams?.status || 'all';
  const search = searchParams?.search || '';
  let confcode = searchParams?.confcode || null;
  const openRegid = (searchParams?.openRegid || '').trim() || null;
  
  // Get conferences available to this user
  const availableConferences = await getAvailableConferences(user);
  
  // Get user's personal default conference from database
  const { data: userData } = await supabase
    .from('users')
    .select('default_conference')
    .eq('user_id', user.user_id)
    .single();
  
  const userDefaultConf = userData?.default_conference || null;
  
  // If no confcode is provided, use the user's default or fall back to first available conference
  if (!confcode) {
    // Use user's personal default if it's in their available conferences
    if (userDefaultConf && availableConferences.includes(userDefaultConf)) {
      const params = new URLSearchParams();
      params.set('confcode', userDefaultConf);
      if (status !== 'all') params.set('status', status);
      if (search) params.set('search', search);
      if (openRegid) params.set('openRegid', openRegid);
      redirect(`/dashboard?${params.toString()}`);
    }
    
    // Fall back to first available conference for this user
    const firstConf = availableConferences.length > 0 ? availableConferences[0] : null;
    if (firstConf) {
      const params = new URLSearchParams();
      params.set('confcode', firstConf);
      if (status !== 'all') params.set('status', status);
      if (search) params.set('search', search);
      if (openRegid) params.set('openRegid', openRegid);
      redirect(`/dashboard?${params.toString()}`);
    }
  } else {
    // Verify the provided confcode is available to this user
    if (!availableConferences.includes(confcode)) {
      // Redirect to first available conference
      const firstConf = availableConferences.length > 0 ? availableConferences[0] : null;
      if (firstConf) {
        const params = new URLSearchParams();
        params.set('confcode', firstConf);
        if (status !== 'all') params.set('status', status);
        if (search) params.set('search', search);
        if (openRegid) params.set('openRegid', openRegid);
        redirect(`/dashboard?${params.toString()}`);
      }
    }
  }
  
  const registrations = await getRegistrations(status, search, confcode);

  let initialHideProvinceLgu = false;
  let initialConferenceIsAward = false;
  if (confcode) {
    const { data: confMeta } = await supabase
      .from('conference')
      .select('is_anc, is_award')
      .eq('confcode', confcode)
      .maybeSingle();
    initialHideProvinceLgu = String(confMeta?.is_anc ?? '').toUpperCase() === 'Y';
    initialConferenceIsAward = String(confMeta?.is_award ?? '').toUpperCase() === 'Y';
  }

  return (
    <RegistrationsPageClient
      initialRegistrations={registrations}
      initialConfcode={confcode}
      initialSearch={search}
      initialOpenRegid={openRegid}
      initialHideProvinceLgu={initialHideProvinceLgu}
      initialConferenceIsAward={initialConferenceIsAward}
    />
  );
}
