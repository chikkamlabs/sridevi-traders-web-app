'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddFirmModal from '@/components/admin/addfirm';
import OpenFirmModal from '@/components/admin/openfirm';
import { getFirms, Firm } from '@/lib/firmsStore';
import { getStoredAuthUser } from '@/lib/auth';
import { Plus, Search, Building2, ExternalLink, RefreshCw } from 'lucide-react';

export default function FirmsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);

  useEffect(() => {
    const fetchAdminAndFirms = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setLoading(true);
      const data = await getFirms();
      setFirms(data);
      setLoading(false);
    };

    fetchAdminAndFirms();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await getFirms();
    setFirms(data);
    setLoading(false);
  };

  const handleFirmAdded = (newFirm: Firm) => {
    setFirms((prev) => [newFirm, ...prev.filter((f) => f.id !== newFirm.id)]);
  };

  const handleFirmUpdated = (updatedFirm: Firm) => {
    setFirms((prev) => prev.map((f) => (f.id === updatedFirm.id ? updatedFirm : f)));
  };

  const handleOpenFirm = (firm: Firm) => {
    setSelectedFirm(firm);
    setIsOpenModalOpen(true);
  };

  // Search filter across firm name
  const filteredFirms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return firms;
    return firms.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        (f.legal_name && f.legal_name.toLowerCase().includes(query))
    );
  }, [firms, searchQuery]);

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
            {/* Top Bar: Title, Total Firms Count, and Add Firm Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Firm Profiles
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Manage business firms, multi-branch entities, GST compliance, and billing profiles.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Total Firms Count Badge */}
                <div className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Total Firms:</span>
                  <span className="font-bold text-base text-[var(--color-brand-deep-green)]">
                    {firms.length}
                  </span>
                </div>

                {/* Add Firm Button */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn btn-primary flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Firm</span>
                </button>
              </div>
            </div>

            {/* Search Bar & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              {/* Search bar (firm name) */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by firm name..."
                  className="input-field pl-9 text-sm"
                />
              </div>

              {/* Refresh & Results Info */}
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  Showing {filteredFirms.length} of {firms.length} firms
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh firms"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Firms List Table */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Firm Name</th>
                      <th className="py-3.5 px-4 sm:px-6">GST Number</th>
                      <th className="py-3.5 px-4 sm:px-6">Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && firms.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading firms...</span>
                        </td>
                      </tr>
                    ) : filteredFirms.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-muted)]">
                          {searchQuery ? 'No firms found matching your search.' : 'No firms registered.'}
                        </td>
                      </tr>
                    ) : (
                      filteredFirms.map((firm) => (
                        <tr
                          key={firm.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors group"
                        >
                          {/* Firm Name */}
                          <td className="py-4 px-4 sm:px-6">
                            <div className="font-semibold text-[var(--color-text-primary)]">
                              {firm.name}
                            </div>
                            {firm.legal_name && (
                              <div className="text-xs text-[var(--color-text-muted)] truncate max-w-sm mt-0.5">
                                {firm.legal_name}
                              </div>
                            )}
                          </td>

                          {/* GST Number */}
                          <td className="py-4 px-4 sm:px-6">
                            {firm.gst_number ? (
                              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)]">
                                {firm.gst_number}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--color-text-muted)]">Not Registered</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                firm.status
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  firm.status ? 'bg-[var(--color-brand-deep-green)]' : 'bg-gray-400'
                                }`}
                              />
                              {firm.status ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Action: Open */}
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenFirm(firm)}
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

      {/* Add Firm Modal */}
      <AddFirmModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onFirmAdded={handleFirmAdded}
      />

      {/* Open Firm Modal */}
      <OpenFirmModal
        firm={selectedFirm}
        isOpen={isOpenModalOpen}
        onClose={() => {
          setIsOpenModalOpen(false);
          setSelectedFirm(null);
        }}
        onFirmUpdated={handleFirmUpdated}
      />
    </div>
  );
}
