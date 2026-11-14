'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getSalesBills, SaleBill } from '@/lib/salesStore';
import { getStoredAuthUser } from '@/lib/auth';
import {
  Plus,
  Search,
  TrendingUp,
  Calendar,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 7);
  return {
    from: formatDateInput(weekAgo),
    to: formatDateInput(today),
  };
}

export default function SalesDashboardPage() {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [sales, setSales] = useState<SaleBill[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSales = useCallback(async (from: string, to: string) => {
    setLoading(true);
    const data = await getSalesBills({
      fromDate: from || undefined,
      toDate: to || undefined,
    });
    setSales(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const initDashboard = async () => {
      const data = await getSalesBills({
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

      setSales(data);
      setLoading(false);
    };

    initDashboard();
    return () => {
      active = false;
    };
  }, [fromDate, toDate]);

  // Search filter on sale_number and invoice_number
  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        s.sale_number.toLowerCase().includes(q) ||
        s.invoice_number.toLowerCase().includes(q)
    );
  }, [sales, searchQuery]);

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
            {/* Top Bar: Title, Total Sales (Filtered Dates), Add Sale Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Sales
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Manage dealer sales bills, line items, and ledger entries.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Total Sales Count (as per filtered dates) */}
                <div className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Total Sales:
                  </span>
                  <span className="font-bold text-base text-[var(--color-brand-deep-green)]">
                    {sales.length}
                  </span>
                </div>

                {/* Add Sale Button */}
                <Link
                  href="/admin/sales/addsale"
                  className="btn btn-primary flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Sale</span>
                </Link>
              </div>
            </div>

            {/* Filters (From-To Dates default last 1 week) & Search Bar (sale_number, invoice_number) */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-1">
                {/* Search Bar */}
                <div className="flex-1 max-w-md">
                  <label htmlFor="sale-search" className="form-label text-xs mb-1">
                    Search Sales
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="sale-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by sale number or invoice number..."
                      className="input-field pl-9 text-sm"
                    />
                  </div>
                </div>

                {/* From Date */}
                <div className="sm:w-44">
                  <label htmlFor="sales-from-date" className="form-label text-xs mb-1">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="sales-from-date"
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
                  <label htmlFor="sales-to-date" className="form-label text-xs mb-1">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="sales-to-date"
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
                  Showing {filteredSales.length} of {sales.length} sales
                </span>
                <button
                  type="button"
                  onClick={() => loadSales(fromDate, toDate)}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh sales"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Sales Table List */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Sale & Invoice No.</th>
                      <th className="py-3.5 px-4 sm:px-6">Dealer</th>
                      <th className="py-3.5 px-4 sm:px-6">Date</th>
                      <th className="py-3.5 px-4 sm:px-6">Total (GST)</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && sales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading sales...</span>
                        </td>
                      </tr>
                    ) : filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[var(--color-text-muted)]">
                          No sales found for the selected date range or search query.
                        </td>
                      </tr>
                    ) : (
                      filteredSales.map((sale) => (
                        <tr
                          key={sale.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors"
                        >
                          {/* Sale Number & Invoice Number */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex flex-col gap-1">
                              <span className="inline-block w-fit px-2.5 py-0.5 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-xs font-semibold text-[var(--color-brand-deep-green)]">
                                {sale.sale_number}
                              </span>
                              <span className="text-xs text-[var(--color-text-secondary)]">
                                Inv:{' '}
                                <strong className="text-[var(--color-text-primary)]">
                                  {sale.invoice_number}
                                </strong>
                              </span>
                            </div>
                          </td>

                          {/* Dealer */}
                          <td className="py-4 px-4 sm:px-6 font-medium text-[var(--color-text-primary)]">
                            <div>{sale.dealer_name || 'Dealer'}</div>
                            {sale.firm_name && (
                              <div className="text-xs text-[var(--color-text-muted)]">
                                {sale.firm_name}
                              </div>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)] whitespace-nowrap">
                            {sale.date}
                          </td>

                          {/* Total (gst_total) */}
                          <td className="py-4 px-4 sm:px-6 font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                            ₹
                            {Number(sale.gst_total || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          {/* Open Action */}
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <Link
                              href={`/admin/sales/opensale?id=${sale.id}`}
                              className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] hover:border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open</span>
                            </Link>
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
