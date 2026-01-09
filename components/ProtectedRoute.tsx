'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: ('admin' | 'reviewer')[];
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication by trying to access dashboard
    // The middleware will handle redirects, but we can also check here
    fetch('/api/registrations?status=all')
      .then((res) => {
        if (res.ok) {
          // User is authenticated
          // We could fetch user info from a dedicated endpoint if needed
          setUser({ user_id: 0, username: '', fullname: '', role: 'reviewer', created_at: '', updated_at: '' });
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">Access Denied</div>
      </div>
    );
  }

  return <>{children}</>;
}


