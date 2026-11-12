'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddUnitModal from '@/components/admin/addunit';
import OpenUnitModal from '@/components/admin/openunit';
import { getUnits, Unit } from '@/lib/unitsStore';
import { getStoredAuthUser } from '@/lib/auth';
import { Plus, Search, Scale, ExternalLink, RefreshCw } from 'lucide-react';

export default function UnitsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);

  useEffect(() => {
    const fetchAdminAndUnits = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setLoading(true);
      const data = await getUnits();
      setUnits(data);
      setLoading(false);
    };

    fetchAdminAndUnits();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await getUnits();
    setUnits(data);
    setLoading(false);
  };

  const handleUnitAdded = (newUnit: Unit) => {
    setUnits((prev) => [newUnit, ...prev.filter((u) => u.id !== newUnit.id)]);
  };

  const handleUnitUpdated = (updatedUnit: Unit) => {
    setUnits((prev) => prev.map((u) => (u.id === updatedUnit.id ? updatedUnit : u)));
  };

  const handleOpenUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsOpenModalOpen(true);
  };

  // Search filter across unit name and usage name
  const filteredUnits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return units;
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.use_name.toLowerCase().includes(query)
    );
  }, [units, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      {/* Sticky Top Header */}
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      {/* Main Body with Sidebar + Content */}
      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title, Total Units Count, and Add Unit Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <Scale className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Measurement Units
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Manage master measurement units used across packaging, sales, and inventory.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Total Units Count Badge */}
                <div className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Total Units:</span>
                  <span className="font-bold text-base text-[var(--color-brand-deep-green)]">
                    {units.length}
                  </span>
                </div>

                {/* Add Unit Button */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn btn-primary flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Unit</span>
                </button>
              </div>
            </div>

            {/* Search Bar & Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search unit by name or usage name..."
                  className="input-field pl-9"
                />
              </div>

              {/* Refresh & Results Info */}
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  Showing {filteredUnits.length} of {units.length} units
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh units"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Units List Table */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Unit Name</th>
                      <th className="py-3.5 px-4 sm:px-6">Full Usage Name</th>
                      <th className="py-3.5 px-4 sm:px-6">Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && units.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading units...</span>
                        </td>
                      </tr>
                    ) : filteredUnits.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-muted)]">
                          {searchQuery ? 'No units found matching your search.' : 'No measurement units found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUnits.map((unit) => (
                        <tr
                          key={unit.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors group"
                        >
                          <td className="py-4 px-4 sm:px-6 font-semibold text-[var(--color-text-primary)]">
                            <span className="px-2.5 py-1 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-xs">
                              {unit.name}
                            </span>
                          </td>
                          <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                            {unit.use_name}
                          </td>
                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                unit.status
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  unit.status ? 'bg-[var(--color-brand-deep-green)]' : 'bg-gray-400'
                                }`}
                              />
                              {unit.status ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenUnit(unit)}
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

      {/* Add Unit Modal */}
      <AddUnitModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUnitAdded={handleUnitAdded}
      />

      {/* Open / Edit Unit Modal */}
      <OpenUnitModal
        unit={selectedUnit}
        isOpen={isOpenModalOpen}
        onClose={() => {
          setIsOpenModalOpen(false);
          setSelectedUnit(null);
        }}
        onUnitUpdated={handleUnitUpdated}
      />
    </div>
  );
}
