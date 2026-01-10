import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ConferencesPage() {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  // Redirect to Configuration page with conferences tab
  redirect('/dashboard/configuration?tab=conferences');
}
