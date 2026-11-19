'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getProducts, getCategories, Product, Category } from '@/lib/productsStore';
import { getStoredAuthUser } from '@/lib/auth';
import { Plus, Search, Package, Filter, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ProductsDashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setLoading(true);
      const [prodsData, catsData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(prodsData);
      setCategories(catsData);
      setLoading(false);
    };

    fetchInitialData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const [prodsData, catsData] = await Promise.all([
      getProducts(),
      getCategories(),
    ]);
    setProducts(prodsData);
    setCategories(catsData);
    setLoading(false);
  };

  // Filter categories for the searchable category selector
  const filteredCategoriesForSelect = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
    );
  }, [categories, categorySearch]);

  // Filter products by search (code, hsn_code, or name) and category
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.product_code.toLowerCase().includes(q) ||
        (p.hsn_code && p.hsn_code.toLowerCase().includes(q));

      const matchesCategory =
        !selectedCategory || p.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const activeCategoryObj = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      {/* Top Header */}
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Bar: Title, Count, Add Product Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <Package className="w-5 h-5" />
                  </div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Store Products
                  </h1>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Manage inventory masters, stock quantities, packaging units, and product codes.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Total Products Count Badge */}
                <div className="px-3.5 py-2 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">Total Products:</span>
                  <span className="font-bold text-base text-[var(--color-brand-deep-green)]">
                    {products.length}
                  </span>
                </div>

                {/* Add Product Link */}
                <Link
                  href="/admin/products/addproduct"
                  className="btn btn-primary flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </Link>
              </div>
            </div>

            {/* Filters & Search Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[var(--color-brand-white)] p-4 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                {/* Search Bar (product_code, hsn_code, name) */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by product code, HSN code, or name..."
                    className="input-field pl-9 text-sm"
                  />
                </div>

                {/* Searchable Category Filter */}
                <div className="relative min-w-[220px]">
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                    className="w-full input-field text-left flex items-center justify-between gap-2 cursor-pointer bg-[var(--color-brand-white)]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Filter className="w-4 h-4 text-[var(--color-brand-deep-green)] shrink-0" />
                      <span className="text-xs sm:text-sm truncate">
                        {activeCategoryObj ? activeCategoryObj.name : 'All Categories'}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">▼</span>
                  </button>

                  {/* Dropdown with Category Search */}
                  {isCategoryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full sm:w-72 bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-lg z-20 p-2 animate-fade-in">
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Search categories..."
                          className="input-field py-1.5 pl-8 text-xs"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('');
                            setIsCategoryDropdownOpen(false);
                            setCategorySearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                            !selectedCategory
                              ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                              : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                          }`}
                        >
                          All Categories
                        </button>

                        {filteredCategoriesForSelect.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(c.id);
                              setIsCategoryDropdownOpen(false);
                              setCategorySearch('');
                            }}
                            className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                              selectedCategory === c.id
                                ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}

                        {filteredCategoriesForSelect.length === 0 && (
                          <div className="p-3 text-center text-gray-500">
                            No matching category
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Refresh & Results Counter */}
              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  Showing {filteredProducts.length} of {products.length} products
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
                  title="Refresh products"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Products Table List */}
            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 sm:px-6">Product Code</th>
                      <th className="py-3.5 px-4 sm:px-6">Name</th>
                      <th className="py-3.5 px-4 sm:px-6">Category</th>
                      <th className="py-3.5 px-4 sm:px-6">Quantity</th>
                      <th className="py-3.5 px-4 sm:px-6">Base Unit</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {loading && products.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--color-text-muted)]">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-brand-deep-green)]" />
                          <span>Loading store products...</span>
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[var(--color-text-muted)]">
                          No products found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((prod) => {
                        const isLowStock = prod.quantity <= prod.minimum_stock;

                        return (
                          <tr
                            key={prod.id}
                            className="hover:bg-[var(--color-surface-hover)] transition-colors group"
                          >
                            {/* Product Code & HSN Code */}
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex flex-col items-start gap-1">
                                <span className="px-2.5 py-1 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-xs font-semibold text-[var(--color-brand-deep-green)]">
                                  {prod.product_code}
                                </span>
                                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                  HSN: {prod.hsn_code || '—'}
                                </span>
                              </div>
                            </td>

                            {/* Name */}
                            <td className="py-4 px-4 sm:px-6 font-medium text-[var(--color-text-primary)]">
                              <div className="max-w-xs sm:max-w-md truncate" title={prod.name}>
                                {prod.name}
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                                {prod.category_name || 'General'}
                              </span>
                            </td>

                            {/* Quantity */}
                            <td className="py-4 px-4 sm:px-6 font-semibold">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={
                                    isLowStock
                                      ? 'text-[var(--color-danger)] font-bold'
                                      : 'text-[var(--color-text-primary)]'
                                  }
                                >
                                  {prod.quantity}
                                </span>
                                {isLowStock && (
                                  <span
                                    title={`Low Stock! Minimum: ${prod.minimum_stock}`}
                                    className="p-0.5 rounded text-[var(--color-danger)]"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Base Unit */}
                            <td className="py-4 px-4 sm:px-6 text-[var(--color-text-secondary)]">
                              <span className="text-xs font-medium">
                                {prod.unit_name || 'Unit'}{' '}
                                {prod.unit_use_name ? `(${prod.unit_use_name})` : ''}
                              </span>
                            </td>

                            {/* Action: Open */}
                            <td className="py-4 px-4 sm:px-6 text-right">
                              <Link
                                href={`/admin/products/openproduct?id=${prod.id}`}
                                className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] hover:border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })
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
