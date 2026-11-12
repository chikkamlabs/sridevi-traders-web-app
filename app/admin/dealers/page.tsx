'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddDealerModal from '@/components/admin/adddealer';
import OpenDealerModal from '@/components/admin/opendealer';
import { getDealers, Dealer } from '@/lib/dealersStore';
import { getStoredAuthUser } from '@/lib/auth';
import { Plus, Search, Users, ExternalLink, RefreshCw, IndianRupee } from 'lucide-react';

export default function DealersPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);

  useEffect(() => {
    const fetchAdminAndDealers = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setLoading(true);
      const data = await getDealers();
      setDealers(data);
      setLoading(false);
    };

    fetchAdminAndDealers();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await getDealers();
    setDealers(data);
    setLoading(false);
  };

  const handleDealerAdded = (newDealer: Dealer) => {
    setDealers((prev) => [newDealer, ...prev.filter((d) => d.id !== newDealer.id)]);
  };

  const handleDealerUpdated = (updatedDealer: Dealer) => {
    setDealers((prev) => prev.map((d) => (d.id === updatedDealer.id ? updatedDealer : d)));
  };

  const handleOpenDealer = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setIsOpenModalOpen(true);
  };

  // Search filter across dealer name and mobile (phone)
  const filteredDealers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return dealers;
    return dealers.filter(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        (d.phone && d.phone.toLowerCase().includes(query))
    );
  }, [dealers, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      {/* Sticky Top Header */}
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      {/* Main Layout Area */}
      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title, Count, Add Dealer Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <Users className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Dealers Directory
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Manage dealer profiles, firm balances, credit standings, and store customer ledgers.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Total Dealers Count Badge */}
                <div className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Total Dealers:</span>
                  <span className="font-bold text-base text-[var(--color-brand-deep-green)]">
                    {dealers.length}
                  </span>
                </div>

                {/* Add Dealer Button */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn btn-primary flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Dealer</span>
                </button>
              </div>
            </div>

            {/* Search Bar & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              {/* Search bar (name and mobile) */}
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

              {/* Refresh & Results Info */}
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  Showing {filteredDealers.length} of {dealers.length} dealers
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh dealers"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Dealers List Table */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Name</th>
                      <th className="py-3.5 px-4 sm:px-6">Mobile</th>
                      <th className="py-3.5 px-4 sm:px-6">Total Balance</th>
                      <th className="py-3.5 px-4 sm:px-6">City</th>
                      <th className="py-3.5 px-4 sm:px-6">Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && dealers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading dealers...</span>
                        </td>
                      </tr>
                    ) : filteredDealers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--color-text-muted)]">
                          {searchQuery ? 'No dealers found matching your search.' : 'No dealers registered yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredDealers.map((dealer) => (
                        <tr
                          key={dealer.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors group"
                        >
                          {/* Name */}
                          <td className="py-4 px-4 sm:px-6 font-semibold text-[var(--color-text-primary)]">
                            <div>{dealer.name}</div>
                            {dealer.gst_number && (
                              <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                GST: {dealer.gst_number}
                              </span>
                            )}
                          </td>

                          {/* Mobile */}
                          <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                            {dealer.phone || '—'}
                          </td>

                          {/* Total Balance (sum of all gst_balances in firm_dealer_balances) */}
                          <td className="py-4 px-4 sm:px-6 font-semibold">
                            <span className="font-mono text-[var(--color-brand-deep-green)]">
                              ₹{(dealer.total_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* City */}
                          <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                            {dealer.city || '—'}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                dealer.status
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  dealer.status ? 'bg-[var(--color-brand-deep-green)]' : 'bg-gray-400'
                                }`}
                              />
                              {dealer.status ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Action: Open */}
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenDealer(dealer)}
                              className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] hover:border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open</span>
                            </button>
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

      {/* Add Dealer Modal */}
      <AddDealerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onDealerAdded={handleDealerAdded}
      />

      {/* Open Dealer Modal */}
      <OpenDealerModal
        dealer={selectedDealer}
        isOpen={isOpenModalOpen}
        onClose={() => {
          setIsOpenModalOpen(false);
          setSelectedDealer(null);
        }}
        onDealerUpdated={handleDealerUpdated}
      />
    </div>
  );
}
