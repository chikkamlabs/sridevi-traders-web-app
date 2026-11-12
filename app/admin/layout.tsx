'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuthUser, getSession, setAuthCookie } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Check if auth query parameter is present (passed from login transition)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auth') === 'admin') {
          setAuthCookie('admin');
          // Clean up the URL query parameter smoothly without triggering reload
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // 2. Check local session storage
      const localUser = getStoredAuthUser();

      // 3. If Supabase is configured, check session
      if (isSupabaseConfigured) {
        const session = await getSession();
        if (session && (!localUser || localUser.role === 'admin')) {
          setIsAuthorized(true);
          return;
        }
      }

      // 4. Verify local user credentials
      if (localUser && localUser.authenticated && localUser.role === 'admin') {
        setIsAuthorized(true);
        return;
      }

      // 5. Fallback check on document cookie
      const hasAuthCookie = typeof document !== 'undefined' && document.cookie
        .split('; ')
        .some((row) => row.startsWith('st_auth=admin'));

      if (hasAuthCookie) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [router]);

  if (isAuthorized === null) {
    return (
      <div className="main-page-container flex-center" suppressHydrationWarning>
        <p className="body-text" suppressHydrationWarning>Checking authorization...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
