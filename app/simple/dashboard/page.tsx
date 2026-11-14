'use client';

import { useState, useEffect } from 'react';
import SimpleHeader from '@/components/simple/header';
import SimpleSidebar from '@/components/simple/sidebar';
import { getSimpleUserProfile } from '@/lib/secretProfile';

export default function SimpleDashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [simpleName, setSimpleName] = useState('');

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const profile = await getSimpleUserProfile();
      if (!active || !profile) return;
      if (profile.name) {
        setSimpleName(profile.name);
      } else if (profile.email) {
        const prefix = profile.email.split('@')[0];
        setSimpleName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      <SimpleHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        simpleName={simpleName}
      />

      <div className="flex flex-1 w-full relative">
        <SimpleSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="bg-[var(--color-brand-white)] p-6 sm:p-8 rounded-xl border border-[var(--color-border)] shadow-xs">
              <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                Welcome Simple
              </h1>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
