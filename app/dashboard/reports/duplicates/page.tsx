import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Conference, User } from '@/types';
import DuplicatesReportClient from './DuplicatesReportClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

async function getConferences(user: User): Promise<Conference[]> {
  try {
    if (user.role === 'reviewer') {
      const { data: assignments, error: assignError } = await supabase
        .from('user_conferences')
        .select('confcode')
        .eq('user_id', user.user_id);

      if (assignError) {
        console.error('Error fetching assignments:', assignError);
        return [];
      }

      const assignedCodes = (assignments || []).map((a: { confcode: string }) => a.confcode);
      if (assignedCodes.length === 0) return [];

      const { data: conferences, error } = await supabase
        .from('conference')
        .select('*')
        .in('confcode', assignedCodes)
        .order('confcode', { ascending: true });

      if (error) {
        console.error('Error fetching conferences:', error);
        return [];
      }
      return conferences || [];
    }

    const { data: conferences, error } = await supabase
      .from('conference')
      .select('*')
      .order('confcode', { ascending: true });

    if (error) {
      console.error('Error fetching conferences:', error);
      return [];
    }
    return conferences || [];
  } catch (error) {
    console.error('Error fetching conferences:', error);
    return [];
  }
}

async function getUserDefaultConference(userId: number): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('users')
      .select('default_conference')
      .eq('user_id', userId)
      .single();
    return data?.default_conference || null;
  } catch {
    return null;
  }
}

export default async function DuplicatesReportPage({
  searchParams,
}: {
  searchParams?: { confcode?: string; status?: string };
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const conferences = await getConferences(user);

  let confcode = searchParams?.confcode || null;
  if (!confcode) {
    const userDefaultConf = await getUserDefaultConference(user.user_id);
    if (userDefaultConf && conferences.some((c) => c.confcode === userDefaultConf)) {
      confcode = userDefaultConf;
    } else if (conferences.length > 0) {
      confcode = conferences[0].confcode;
    }
  }

  return (
    <DuplicatesReportClient
      initialConferences={conferences}
      initialConfcode={confcode}
      initialStatus={searchParams?.status || 'ALL'}
    />
  );
}
