'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getStoredAuthUser } from '@/lib/auth';
import {
  getAdminDashboardStats,
  AdminDashboardStats,
} from '@/lib/admindashboardStore';
import { ShoppingCart, TrendingUp, Package, RefreshCw } from 'lucide-react';

export default function AdminDashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDashboard = async () => {
      const dashboardStats = await getAdminDashboardStats();
      if (!active) return;

      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setStats(dashboardStats);
      setLoading(false);
    };

    fetchDashboard();
    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const dashboardStats = await getAdminDashboardStats();
    setStats(dashboardStats);
    setLoading(false);
  };

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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {stats
                    ? `Weekly overview from ${stats.weekFromDate} to ${stats.weekToDate}`
                    : 'Overview of this week purchases, sales, and store products.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="btn btn-outline btn-sm self-start sm:self-auto inline-flex items-center gap-2 cursor-pointer"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Summary Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Purchases (This week) */}
              <Link
                href="/admin/purchases"
                className="card-interactive p-6 flex flex-col justify-between gap-4 bg-[var(--color-brand-white)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Total Purchases (This Week)
                  </span>
                  <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                  {loading ? '—' : stats?.totalPurchasesThisWeek ?? 0}
                </div>
                <div className="text-xs text-[var(--color-brand-deep-green)] font-medium">
                  View Purchases →
                </div>
              </Link>

              {/* Total Sales (This week) */}
              <Link
                href="/admin/sales"
                className="card-interactive p-6 flex flex-col justify-between gap-4 bg-[var(--color-brand-white)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Total Sales (This Week)
                  </span>
                  <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                  {loading ? '—' : stats?.totalSalesThisWeek ?? 0}
                </div>
                <div className="text-xs text-[var(--color-brand-deep-green)] font-medium">
                  View Sales →
                </div>
              </Link>

              {/* Total Products (Count) */}
              <Link
                href="/admin/products"
                className="card-interactive p-6 flex flex-col justify-between gap-4 bg-[var(--color-brand-white)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Total Products
                  </span>
                  <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <Package className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                  {loading ? '—' : stats?.totalProducts ?? 0}
                </div>
                <div className="text-xs text-[var(--color-brand-deep-green)] font-medium">
                  View Store Products →
                </div>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
