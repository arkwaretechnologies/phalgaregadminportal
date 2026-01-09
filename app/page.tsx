import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

// Force dynamic rendering - this page uses cookies
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSession();

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}


