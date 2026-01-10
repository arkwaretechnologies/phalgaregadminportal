import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Conference } from '@/types';
import BatchesReportClient from './BatchesReportClient';

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

async function getDefaultConference(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('config')
      .select('paramvalue')
      .eq('paramname', 'DEFAULT_CONFERENCE')
      .maybeSingle();
    return data?.paramvalue || null;
  } catch {
    return null;
  }
}

export default async function BatchesReportPage({
  searchParams,
}: {
  searchParams?: { confcode?: string };
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const conferences = await getConferences();
  
  // Use URL param, then default from config, then first conference
  let confcode = searchParams?.confcode || null;
  if (!confcode) {
    const defaultConf = await getDefaultConference();
    // Verify default conference exists
    if (defaultConf && conferences.some(c => c.confcode === defaultConf)) {
      confcode = defaultConf;
    } else if (conferences.length > 0) {
      confcode = conferences[0].confcode;
    }
  }

  return (
    <BatchesReportClient
      initialConferences={conferences}
      initialConfcode={confcode}
    />
  );
}
