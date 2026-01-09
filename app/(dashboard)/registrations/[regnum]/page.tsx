import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { RegistrationDetail } from '@/types';
import RegistrationDetailClient from './RegistrationDetailClient';

async function getRegistration(regnum: number): Promise<RegistrationDetail | null> {
  try {
    // Fetch registration header
    const { data: registration, error: regError } = await supabase
      .from('regh')
      .select('*')
      .eq('regnum', regnum)
      .single();

    if (regError || !registration) {
      return null;
    }

    // Fetch registration details (from regd table if exists)
    const { data: regd } = await supabase
      .from('regd')
      .select('*')
      .eq('regnum', regnum)
      .order('linenum', { ascending: true });

    return {
      ...registration,
      regd: regd || undefined,
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

  const regnum = parseInt(params.regnum);

  if (isNaN(regnum)) {
    notFound();
  }

  const registration = await getRegistration(regnum);

  if (!registration) {
    notFound();
  }

  return <RegistrationDetailClient registration={registration} />;
}