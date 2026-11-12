'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddCategoryModal from '@/components/admin/addcategory';
import OpenCategoryModal from '@/components/admin/opencategory';
import { getCategories, Category } from '@/lib/categoriesStore';
import { getStoredAuthUser } from '@/lib/auth';
import { Plus, Search, Layers, ExternalLink, RefreshCw } from 'lucide-react';

export default function CategoriesPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);

  useEffect(() => {
    const fetchAdminAndCategories = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setLoading(true);
      const data = await getCategories();
      setCategories(data);
      setLoading(false);
    };

    fetchAdminAndCategories();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await getCategories();
    setCategories(data);
    setLoading(false);
  };

  const handleCategoryAdded = (newCat: Category) => {
    setCategories((prev) => [newCat, ...prev.filter((c) => c.id !== newCat.id)]);
  };

  const handleCategoryUpdated = (updatedCat: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === updatedCat.id ? updatedCat : c)));
  };

  const handleOpenCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setIsOpenModalOpen(true);
  };

  // Search filter across category_code and category name
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter(
      (c) =>
        c.category_code.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

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
            {/* Top Bar: Title, Total Categories Count, and Add Category Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Product Categories
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Manage master categories for inventory segmentation, taxation rates, and catalogue reporting.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Total Categories Count Badge */}
                <div className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Total Categories:</span>
                  <span className="font-bold text-base text-[var(--color-brand-deep-green)]">
                    {categories.length}
                  </span>
                </div>

                {/* Add Category Button */}
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn btn-primary flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </div>
            </div>

            {/* Search Bar & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              {/* Search bar (category_code and category name) */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by category code or name..."
                  className="input-field pl-9 text-sm"
                />
              </div>

              {/* Refresh & Results Info */}
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  Showing {filteredCategories.length} of {categories.length} categories
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh categories"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Categories List Table */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Category Code</th>
                      <th className="py-3.5 px-4 sm:px-6">Name</th>
                      <th className="py-3.5 px-4 sm:px-6">Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && categories.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading categories...</span>
                        </td>
                      </tr>
                    ) : filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[var(--color-text-muted)]">
                          {searchQuery ? 'No categories found matching your search.' : 'No categories registered.'}
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat) => (
                        <tr
                          key={cat.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors group"
                        >
                          {/* Category Code */}
                          <td className="py-4 px-4 sm:px-6">
                            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-brand-deep-green)]">
                              {cat.category_code}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="py-4 px-4 sm:px-6 font-semibold text-[var(--color-text-primary)]">
                            {cat.name}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4 sm:px-6">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                cat.status
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  cat.status ? 'bg-[var(--color-brand-deep-green)]' : 'bg-gray-400'
                                }`}
                              />
                              {cat.status ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          {/* Action: Open */}
                          <td className="py-4 px-4 sm:px-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenCategory(cat)}
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

      {/* Add Category Modal */}
      <AddCategoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCategoryAdded={handleCategoryAdded}
      />

      {/* Open Category Modal */}
      <OpenCategoryModal
        category={selectedCategory}
        isOpen={isOpenModalOpen}
        onClose={() => {
          setIsOpenModalOpen(false);
          setSelectedCategory(null);
        }}
        onCategoryUpdated={handleCategoryUpdated}
      />
    </div>
  );
}
