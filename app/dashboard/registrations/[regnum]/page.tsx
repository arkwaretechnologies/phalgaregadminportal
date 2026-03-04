import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { RegistrationDetail } from '@/types';
import RegistrationDetailClient from './RegistrationDetailClient';

// Force dynamic rendering - this page requires authentication and database access
export const dynamic = 'force-dynamic';

async function getRegistrationByRegid(regid: string): Promise<RegistrationDetail | null> {
  try {
    const { data: registration, error: regError } = await supabase
      .from('regh')
      .select('*')
      .eq('regid', regid)
      .maybeSingle();

    if (regError || !registration) {
      return null;
    }

    let regd = undefined;
    if (registration.regid) {
      const { data } = await supabase
        .from('regd')
        .select('*')
        .eq('regid', registration.regid)
        .order('linenum', { ascending: true });
      regd = data || undefined;
    }

    return { ...registration, regd };
  } catch (error) {
    console.error('Error fetching registration:', error);
    return null;
  }
}

async function getRegistrationByBatchnum(batchnum: number): Promise<RegistrationDetail | null> {
  try {
    const { data: registration, error: regError } = await supabase
      .from('regh')
      .select('*')
      .eq('batchnum', batchnum)
      .single();

    if (regError || !registration) {
      return null;
    }

    let regd = undefined;
    if (registration.regid) {
      const { data } = await supabase
        .from('regd')
        .select('*')
        .eq('regid', registration.regid)
        .order('linenum', { ascending: true });
      regd = data || undefined;
    }

    return { ...registration, regd };
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

  const decodedRegnum = decodeURIComponent(params.regnum);
  const batchnum = parseInt(decodedRegnum, 10);
  const isNumeric = !isNaN(batchnum) && /^\d+$/.test(decodedRegnum);

  const registration = isNumeric
    ? await getRegistrationByBatchnum(batchnum)
    : await getRegistrationByRegid(decodedRegnum);

  if (!registration) {
    notFound();
  }

  return <RegistrationDetailClient registration={registration} />;
}
