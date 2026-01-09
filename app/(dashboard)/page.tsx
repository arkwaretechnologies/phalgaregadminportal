import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Registration } from '@/types';
import RegistrationList from '@/components/RegistrationList';

async function getRegistrations(status: string = 'all', search: string = ''): Promise<Registration[]> {
  try {
    let query = supabase
      .from('regh')
      .select('*')
      .order('regdate', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(
        `transid.ilike.%${search}%,email.ilike.%${search}%,contactperson.ilike.%${search}%`
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
  searchParams: { status?: string; search?: string };
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const status = searchParams?.status || 'all';
  const search = searchParams?.search || '';
  const registrations = await getRegistrations(status, search);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registrations</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage participant registrations
        </p>
      </div>
      <RegistrationList initialRegistrations={registrations} />
    </div>
  );
}