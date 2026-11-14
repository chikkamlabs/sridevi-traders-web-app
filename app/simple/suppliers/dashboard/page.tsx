'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import SimpleHeader from '@/components/simple/header';
import SimpleSidebar from '@/components/simple/sidebar';
import { getSimpleSuppliers, SimpleSupplier } from '@/lib/simple/nsuppliersStore';
import { getSimpleUserProfile } from '@/lib/secretProfile';
import { Search, Truck, ExternalLink, RefreshCw } from 'lucide-react';

export default function SimpleSuppliersDashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [simpleName, setSimpleName] = useState('');
  const [suppliers, setSuppliers] = useState<SimpleSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let active = true;
    const initDashboard = async () => {
      const [data, profile] = await Promise.all([
        getSimpleSuppliers(),
        getSimpleUserProfile(),
      ]);
      if (!active) return;

      if (profile?.name) {
        setSimpleName(profile.name);
      } else if (profile?.email) {
        const prefix = profile.email.split('@')[0];
        setSimpleName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      setSuppliers(data);
      setLoading(false);
    };

    initDashboard();
    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await getSimpleSuppliers();
    setSuppliers(data);
    setLoading(false);
  };

  // Search filter across supplier name and mobile (phone)
  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.phone && s.phone.toLowerCase().includes(query))
    );
  }, [suppliers, searchQuery]);

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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title & Total Suppliers Count */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <Truck className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Suppliers
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  View supplier N-GST balances and transaction ledgers.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Total Suppliers Count Badge */}
                <div className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Total Suppliers:
                  </span>
                  <span className="font-bold text-base text-[var(--color-brand-deep-green)]">
                    {suppliers.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Search Bar & Refresh */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or mobile number..."
                  className="input-field pl-9 text-sm"
                />
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  Showing {filteredSuppliers.length} of {suppliers.length} suppliers
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh suppliers"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Suppliers List Table */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Name</th>
                      <th className="py-3.5 px-4 sm:px-6">Mobile</th>
                      <th className="py-3.5 px-4 sm:px-6">Total Balance (N-GST)</th>
                      <th className="py-3.5 px-4 sm:px-6">City</th>
                      <th className="py-3.5 px-4 sm:px-6">Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading suppliers...</span>
                        </td>
                      </tr>
                    ) : filteredSuppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--color-text-muted)]">
                          {searchQuery ? 'No suppliers found matching your search.' : 'No suppliers registered yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSuppliers.map((supplier) => (
                        <tr
                          key={supplier.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors"
                        >
                          {/* Name */}
                          <td className="py-4 px-4 sm:px-6 font-semibold text-[var(--color-text-primary)]">
                            <div>{supplier.name}</div>
                            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                              Code: {supplier.supplier_code}
                            </span>
                          </td>

                          {/* Mobile */}
                          <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                            {supplier.phone || '—'}
                          </td>

                          {/* Total Balance (sum of all n_gst_balances in firm_supplier_balances) */}
                          <td className="py-4 px-4 sm:px-6 font-semibold">
                            <span className="font-mono text-[var(--color-brand-deep-green)]">
                              ₹{(supplier.total_balance || 0).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>

                          {/* City */}
                          <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                            {supplier.city || '—'}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                supplier.status
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  supplier.status ? 'bg-[var(--color-brand-deep-green)]' : 'bg-gray-400'
                                }`}
                              />
                              {supplier.status ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Action: Financials */}
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <Link
                              href={`/simple/suppliers/financials?id=${supplier.id}`}
                              className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] hover:border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Financials</span>
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
