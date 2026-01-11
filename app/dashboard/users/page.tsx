import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import UserTable from '@/components/UserTable';

// Force dynamic rendering - this page requires authentication and database access
export const dynamic = 'force-dynamic';

async function getUsers(): Promise<User[]> {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('user_id, username, fullname, role, default_conference, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    // Fetch assigned conferences for each user
    const usersWithConferences = await Promise.all(
      (users || []).map(async (user) => {
        if (user.role === 'reviewer') {
          const { data: assignments } = await supabase
            .from('user_conferences')
            .select('confcode')
            .eq('user_id', user.user_id);
          return {
            ...user,
            assigned_conferences: (assignments || []).map((a: { confcode: string }) => a.confcode),
            default_conference: user.default_conference || null,
          };
        }
        return { ...user, assigned_conferences: [], default_conference: user.default_conference || null };
      })
    );

    return usersWithConferences;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export default async function UsersPage() {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  const users = await getUsers();

  return <UserTable initialUsers={users} />;
}
