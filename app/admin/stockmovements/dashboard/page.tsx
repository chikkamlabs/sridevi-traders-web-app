'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getStockMovements, StockMovement } from '@/lib/stockmovements';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeftRight,
  Search,
  Calendar,
  RefreshCw,
  Plus,
} from 'lucide-react';

function getTodayDateInput(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function StockMovementsDashboardPage() {
  const todayStr = useMemo(() => getTodayDateInput(), []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (From to Dates default today) & Search (product_code or name)
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState('');

  const loadMovements = useCallback(async (from: string, to: string) => {
    setLoading(true);
    const data = await getStockMovements({
      fromDate: from || undefined,
      toDate: to || undefined,
    });
    setMovements(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const initDashboard = async () => {
      const data = await getStockMovements({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      if (!active) return;

      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setMovements(data);
      setLoading(false);
    };

    initDashboard();
    return () => {
      active = false;
    };
  }, [fromDate, toDate]);

  // Search filter on product_code or product name
  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter(
      (m) =>
        m.product_name.toLowerCase().includes(q) ||
        m.product_code.toLowerCase().includes(q)
    );
  }, [movements, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title & Stock Movement Button (no action) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Stock Movements
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Track product stock inward and outward inventory movements.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Stock Movement Button (Just create button no action) */}
                <button
                  type="button"
                  className="btn btn-primary flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Stock Movement</span>
                </button>
              </div>
            </div>

            {/* Filters (From-To Dates default today) & Search Bar (product_code or name) */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-1">
                {/* Search Bar */}
                <div className="flex-1 max-w-md">
                  <label htmlFor="stock-movement-search" className="form-label text-xs mb-1">
                    Search Product
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="stock-movement-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by product code or name..."
                      className="input-field pl-9 text-sm"
                    />
                  </div>
                </div>

                {/* From Date */}
                <div className="sm:w-44">
                  <label htmlFor="from-date" className="form-label text-xs mb-1">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setLoading(true);
                        setFromDate(e.target.value);
                      }}
                      className="input-field pl-9 text-sm"
                    />
                  </div>
                </div>

                {/* To Date */}
                <div className="sm:w-44">
                  <label htmlFor="to-date" className="form-label text-xs mb-1">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setLoading(true);
                        setToDate(e.target.value);
                      }}
                      className="input-field pl-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Refresh & Count */}
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  Showing {filteredMovements.length} of {movements.length} movements
                </span>
                <button
                  type="button"
                  onClick={() => loadMovements(fromDate, toDate)}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh stock movements"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Stock Movements Table List */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Product Name</th>
                      <th className="py-3.5 px-4 sm:px-6">Movement Type</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Quantity Base</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Remaining Quantity</th>
                      <th className="py-3.5 px-4 sm:px-6">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && movements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading stock movements...</span>
                        </td>
                      </tr>
                    ) : filteredMovements.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--color-text-muted)]">
                          No stock movements found for the selected date range or search query.
                        </td>
                      </tr>
                    ) : (
                      filteredMovements.map((mov) => (
                        <tr
                          key={mov.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors"
                        >
                          {/* Product Name */}
                          <td className="py-4 px-4 sm:px-6 font-medium text-[var(--color-text-primary)]">
                            <div>{mov.product_name}</div>
                            {mov.product_code && (
                              <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                {mov.product_code}
                              </span>
                            )}
                          </td>

                          {/* Movement Type */}
                          <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase border ${
                                mov.movement_type === 'in'
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]'
                                  : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]'
                              }`}
                            >
                              {mov.movement_type}
                            </span>
                          </td>

                          {/* Quantity Base */}
                          <td className="py-4 px-4 sm:px-6 text-right font-mono font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                            {Number(mov.quantity_base || 0)}
                          </td>

                          {/* Remaining Quantity */}
                          <td className="py-4 px-4 sm:px-6 text-right font-mono font-semibold text-[var(--color-brand-deep-green)] whitespace-nowrap">
                            {mov.remaining_quantity !== null &&
                            mov.remaining_quantity !== undefined
                              ? mov.remaining_quantity
                              : '—'}
                          </td>

                          {/* Notes */}
                          <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                            {mov.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
