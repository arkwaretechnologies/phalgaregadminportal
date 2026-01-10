import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Registration } from '@/types';
import RegistrationsPageClient from '@/components/RegistrationsPageClient';

// Force dynamic rendering - this page requires authentication and database access
export const dynamic = 'force-dynamic';

async function getRegistrations(status: string = 'all', search: string = '', confcode: string | null = null): Promise<Registration[]> {
  try {
    let query = supabase
      .from('regh')
      .select('*')
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

    return registrations || [];
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return [];
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string; confcode?: string };
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const status = searchParams?.status || 'all';
  const search = searchParams?.search || '';
  let confcode = searchParams?.confcode || null;
  
  // If no confcode is provided, default to the first conference
  if (!confcode) {
    const { data: conferences } = await supabase
      .from('conference')
      .select('confcode')
      .order('confcode', { ascending: true })
      .limit(1);
    
    if (conferences && conferences.length > 0) {
      confcode = conferences[0].confcode;
    }
  }
  
  const registrations = await getRegistrations(status, search, confcode);

  return (
    <RegistrationsPageClient initialRegistrations={registrations} />
  );
}
