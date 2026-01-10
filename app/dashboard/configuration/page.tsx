import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ConfigurationClient from './ConfigurationClient';

export const dynamic = 'force-dynamic';

export default async function ConfigurationPage() {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  return <ConfigurationClient />;
}

