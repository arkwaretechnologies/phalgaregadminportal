import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { RegistrationDetail } from '@/types';
import RegistrationDetailClient from './RegistrationDetailClient';

// Force dynamic rendering - this page requires authentication and database access
export const dynamic = 'force-dynamic';

async function getRegistration(batchnum: number): Promise<RegistrationDetail | null> {
  try {
    // Fetch registration header
    const { data: registration, error: regError } = await supabase
      .from('regh')
      .select('*')
      .eq('batchnum', batchnum)
      .single();

    if (regError || !registration) {
      return null;
    }

    // Fetch registration details (from regd table if exists)
    // regd is linked to regh by regid, not batchnum (batchnum is only generated when approved)
    let regd = undefined;
    if (registration.regid) {
      const { data } = await supabase
        .from('regd')
        .select('*')
        .eq('regid', registration.regid)
        .order('linenum', { ascending: true });
      regd = data || undefined;
    }

    return {
      ...registration,
      regd,
    };
  } catch (error) {
    console.error('Error fetching registration:', error);
    return null;
  }
}

export default async function RegistrationDetailPage({
  params,
}: {
  params: { regnum: string };
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const batchnum = parseInt(params.regnum);

  if (isNaN(batchnum)) {
    notFound();
  }

  const registration = await getRegistration(batchnum);

  if (!registration) {
    notFound();
  }

  return <RegistrationDetailClient registration={registration} />;
}