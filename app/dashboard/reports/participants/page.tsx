import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Conference } from '@/types';
import ApprovedParticipantsClient from './ApprovedParticipantsClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

async function getConferences(): Promise<Conference[]> {
  try {
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

export default async function ApprovedParticipantsPage({
  searchParams,
}: {
  searchParams?: { confcode?: string };
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const conferences = await getConferences();
  const confcode = searchParams?.confcode || (conferences.length > 0 ? conferences[0].confcode : null);

  return (
    <ApprovedParticipantsClient
      initialConferences={conferences}
      initialConfcode={confcode}
    />
  );
}
