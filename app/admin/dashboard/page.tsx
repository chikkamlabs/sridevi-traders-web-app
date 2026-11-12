'use client';

import { useState, useEffect } from 'react';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getStoredAuthUser } from '@/lib/auth';

export default function AdminDashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  useEffect(() => {
    const fetchAdminDetails = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }
    };

    fetchAdminDetails();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      {/* Header sticking to top covering everything */}
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      {/* Area after header: Left sticky sidebar and dashboard content */}
      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 flex items-center justify-center p-6 md:p-8 min-h-[calc(100vh-4rem)]">
          <div className="card max-w-md w-full p-8 text-center border border-[var(--color-border)] shadow-md" suppressHydrationWarning>
            <h1 className="page-title text-[var(--color-primary)]" suppressHydrationWarning>
              Welcome Admin
            </h1>
          </div>
        </main>
      </div>
    </div>
  );
}
