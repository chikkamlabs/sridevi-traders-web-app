'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import {
  getProductById,
  updateProduct,
  getCategories,
  Product,
  Category,
} from '@/lib/productsStore';
import { getUnits, Unit } from '@/lib/unitsStore';
import {
  getProductVariants,
  addProductVariant,
  updateProductVariant,
  deleteProductVariant,
  generateVariantCode,
  ProductVariant,
} from '@/lib/productvariantsStore';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  Edit,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Barcode,
} from 'lucide-react';

interface EditableVariant {
  id: string;
  isNew?: boolean;
  variant_name: string;
  variant_code: string;
  barcode: string;
  conversion_to_base: number | string;
  status: boolean;
}

function OpenProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  // Product & Options Data
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable Product Fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [minimumStock, setMinimumStock] = useState<number | string>('0');
  const [quantity, setQuantity] = useState<number | string>('0');
  const [status, setStatus] = useState(true);

  // Searchable Category dropdown
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  // Product Variants State (Must maintain at least one variant)
  const [variants, setVariants] = useState<EditableVariant[]>([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);

  // Alerts
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      if (!productId) {
        setError('No product ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const [prod, cats, uns, existingVariants] = await Promise.all([
        getProductById(productId),
        getCategories(),
        getUnits(),
        getProductVariants(productId),
      ]);

      setCategories(cats);
      setUnits(uns);

      if (prod) {
        setProduct(prod);
        setName(prod.name || '');
        setCategoryId(prod.category_id || (cats[0]?.id || ''));
        setBaseUnitId(prod.base_unit_id || (uns[0]?.id || ''));
        setMinimumStock(prod.minimum_stock ?? 0);
        setQuantity(prod.quantity ?? 0);
        setStatus(prod.status ?? true);

        // Format variants
        if (existingVariants && existingVariants.length > 0) {
          setVariants(
            existingVariants.map((v) => ({
              id: v.id,
              isNew: false,
              variant_name: v.variant_name,
              variant_code: v.variant_code,
              barcode: v.barcode || '',
              conversion_to_base: v.conversion_to_base,
              status: v.status ?? true,
            }))
          );
        } else {
          // If product had no variants previously, ensure at least one variant is present
          setVariants([
            {
              id: 'new-' + Math.random().toString(36).substring(2, 9),
              isNew: true,
              variant_name: `${prod.name} (Base Unit)`,
              variant_code: generateVariantCode(),
              barcode: '',
              conversion_to_base: '1',
              status: true,
            },
          ]);
        }
      } else {
        setError('Product not found.');
      }

      setLoading(false);
    };

    fetchAllData();
  }, [productId]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())
    );
  }, [categories, categorySearchQuery]);

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);
  const selectedUnitObj = units.find((u) => u.id === baseUnitId);

  // Variant Manipulation Handlers
  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        id: 'new-' + Math.random().toString(36).substring(2, 9),
        isNew: true,
        variant_name: '',
        variant_code: generateVariantCode(),
        barcode: '',
        conversion_to_base: '1',
        status: true,
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      setError('A product must have at least one variant. Cannot delete the only remaining variant.');
      return;
    }

    const target = variants[index];
    if (!target.isNew) {
      setDeletedVariantIds((prev) => [...prev, target.id]);
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof EditableVariant,
    value: any
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleRegenerateCode = (index: number) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, variant_code: generateVariantCode() } : v))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Product name cannot be empty.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }
    if (!baseUnitId) {
      setError('Please select a base unit.');
      return;
    }

    const minStockNum = Number(minimumStock);
    const quantityNum = Number(quantity);

    if (isNaN(minStockNum) || minStockNum < 0) {
      setError('Minimum stock must be a non-negative number.');
      return;
    }
    if (isNaN(quantityNum) || quantityNum < 0) {
      setError('Quantity must be a non-negative number.');
      return;
    }

    // Validate Variants: make sure at least one variant exists
    if (variants.length === 0) {
      setError('Make sure at least one variant is maintained for this product.');
      return;
    }

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.variant_name.trim()) {
        setError(`Variant #${i + 1} name is required.`);
        return;
      }
      if (!v.variant_code.trim()) {
        setError(`Variant #${i + 1} code is required.`);
        return;
      }
      const conv = Number(v.conversion_to_base);
      if (isNaN(conv) || conv <= 0) {
        setError(`Variant "${v.variant_name || `#${i + 1}`}" conversion factor must be greater than 0.`);
        return;
      }
    }

    setIsSaving(true);

    try {
      // 1. Update Product Details (excluding product_code)
      const { data: updatedProd, error: updateErr } = await updateProduct(product.id, {
        name: cleanName,
        category_id: categoryId,
        base_unit_id: baseUnitId,
        minimum_stock: minStockNum,
        quantity: quantityNum,
        status,
      });

      if (updateErr || !updatedProd) {
        setError(updateErr || 'Failed to update product details.');
        setIsSaving(false);
        return;
      }

      // 2. Delete removed variants
      for (const delId of deletedVariantIds) {
        await deleteProductVariant(delId, product.id);
      }

      // 3. Insert or Update variants
      for (const v of variants) {
        if (v.isNew) {
          await addProductVariant({
            product_id: product.id,
            variant_name: v.variant_name.trim(),
            variant_code: v.variant_code.trim(),
            barcode: v.barcode.trim() || undefined,
            conversion_to_base: Number(v.conversion_to_base),
            status: v.status,
          });
        } else {
          await updateProductVariant(v.id, {
            variant_name: v.variant_name.trim(),
            variant_code: v.variant_code.trim(),
            barcode: v.barcode.trim() || undefined,
            conversion_to_base: Number(v.conversion_to_base),
            status: v.status,
          });
        }
      }

      setProduct(updatedProd);
      setSuccessMsg('Product details and variants updated successfully!');
      setIsSaving(false);

      setTimeout(() => {
        router.push('/admin/products/dashboard');
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating product.';
      setError(msg);
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      {/* Top Header */}
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      {/* Main Layout */}
      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Back button */}
            <div className="flex items-center justify-between">
              <Link
                href="/admin/products/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Store Products</span>
              </Link>
            </div>

            {loading ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-12 text-center text-[var(--color-text-muted)]">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[var(--color-brand-deep-green)]" />
                <span>Loading product details...</span>
              </div>
            ) : !product ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-danger-text)]">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[var(--color-danger)]" />
                <p className="font-semibold">{error || 'Product could not be found.'}</p>
                <Link
                  href="/admin/products/dashboard"
                  className="btn btn-outline btn-sm mt-4 inline-flex"
                >
                  Return to Dashboard
                </Link>
              </div>
            ) : (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-6">
                {/* Title */}
                <div className="flex items-center justify-between pb-6 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                      <Edit className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                        Product Details & Editor
                      </h1>
                      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                        Edit product metadata, categories, units, and packaging variants.
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                      product.status
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        product.status ? 'bg-[var(--color-brand-deep-green)]' : 'bg-gray-400'
                      }`}
                    />
                    {product.status ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Alerts */}
                {error && (
                  <div className="p-4 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2.5 animate-fade-in">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-danger)]" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-4 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2.5 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--color-brand-deep-green)]" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSave} className="space-y-6">
                  {/* Product Code (Read-Only per instruction) */}
                  <div className="form-group mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="product-code-readonly" className="form-label mb-0">
                        Product Code
                      </label>
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] font-medium">
                        <Lock className="w-3.5 h-3.5" />
                        System Protected (Read-Only)
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="product-code-readonly"
                        type="text"
                        value={product.product_code}
                        readOnly
                        disabled
                        className="input-field bg-[var(--color-surface-hover)] font-mono font-bold text-[var(--color-brand-deep-green)] cursor-not-allowed border-dashed"
                      />
                    </div>
                    <span className="small-text mt-1">
                      Product codes are immutable unique identifiers and cannot be altered.
                    </span>
                  </div>

                  {/* Product Name */}
                  <div className="form-group mb-0">
                    <label htmlFor="edit-product-name" className="form-label">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-product-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Searchable Category Selection */}
                  <div className="form-group mb-0 relative">
                    <label htmlFor="edit-product-category" className="form-label">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <button
                      id="edit-product-category"
                      type="button"
                      onClick={() => setIsCategoryPickerOpen((prev) => !prev)}
                      className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)]"
                      disabled={isSaving}
                    >
                      <span className="text-sm truncate">
                        {selectedCategoryObj ? selectedCategoryObj.name : 'Select a category'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">▼</span>
                    </button>

                    {isCategoryPickerOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                        <div className="relative mb-2">
                          <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={categorySearchQuery}
                            onChange={(e) => setCategorySearchQuery(e.target.value)}
                            placeholder="Search categories..."
                            className="input-field py-1.5 pl-8 text-xs"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                          {filteredCategories.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setCategoryId(c.id);
                                setIsCategoryPickerOpen(false);
                                setCategorySearchQuery('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                                categoryId === c.id
                                  ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                  : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Base Unit */}
                  <div className="form-group mb-0">
                    <label htmlFor="edit-product-unit" className="form-label">
                      Base Measurement Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="edit-product-unit"
                      required
                      value={baseUnitId}
                      onChange={(e) => setBaseUnitId(e.target.value)}
                      className="select-field text-sm"
                      disabled={isSaving}
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.use_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stock Quantities in 2 Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Minimum Stock */}
                    <div className="form-group mb-0">
                      <label htmlFor="edit-minimum-stock" className="form-label">
                        Minimum Stock Level <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="edit-minimum-stock"
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={minimumStock}
                        onChange={(e) => setMinimumStock(e.target.value)}
                        className="input-field text-sm"
                        disabled={isSaving}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="form-group mb-0">
                      <label htmlFor="edit-quantity" className="form-label">
                        Current Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="edit-quantity"
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="input-field text-sm"
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  {/* Status Toggle */}
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                    <div>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Product Active Status
                      </span>
                      <p className="small-text mt-0.5">
                        Active products are available in sales and purchase billing.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={status}
                        onChange={(e) => setStatus(e.target.checked)}
                        className="sr-only peer"
                        disabled={isSaving}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-deep-green)]"></div>
                    </label>
                  </div>

                  {/* PRODUCT VARIANTS SECTION (Instructed: here Also show ask the product_variants. Also allow to edit and add new variants. make sure atleast one variant Should have.) */}
                  <div className="pt-2 border-t border-[var(--color-border)] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
                        <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                          Product Packaging Variants
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                        disabled={isSaving}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Variant</span>
                      </button>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Manage packaging sizes (e.g. 50kg, 25kg, 1kg). Each variant defines its conversion factor to base unit <strong>({selectedUnitObj?.name || 'Base'})</strong>. At least one variant must be kept.
                    </p>

                    <div className="space-y-3">
                      {variants.map((v, idx) => (
                        <div
                          key={v.id}
                          className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] space-y-3 relative"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[var(--color-brand-deep-green)] text-white text-xs font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                                {v.variant_name || `Variant #${idx + 1}`}
                              </span>
                              {v.isNew && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] border border-[var(--color-border-subtle)]">
                                  New
                                </span>
                              )}
                            </div>

                            {/* Remove button (enforcing >= 1 variant) */}
                            {variants.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveVariant(idx)}
                                className="text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] p-1.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                                title="Delete variant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Variant Name */}
                            <div className="form-group mb-0">
                              <label className="form-label text-xs">
                                Variant Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                value={v.variant_name}
                                onChange={(e) => handleVariantChange(idx, 'variant_name', e.target.value)}
                                placeholder="e.g. 25kg Bag, 1kg Pouch"
                                className="input-field text-xs py-1.5"
                                disabled={isSaving}
                              />
                            </div>

                            {/* Variant Code */}
                            <div className="form-group mb-0">
                              <div className="flex items-center justify-between mb-1">
                                <label className="form-label text-xs mb-0">
                                  Variant Code <span className="text-red-500">*</span>
                                </label>
                                {v.isNew && (
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateCode(idx)}
                                    className="text-[11px] text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Regen</span>
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                required
                                value={v.variant_code}
                                onChange={(e) => handleVariantChange(idx, 'variant_code', e.target.value)}
                                className="input-field text-xs py-1.5 font-mono font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
                                disabled={isSaving}
                              />
                            </div>

                            {/* Barcode */}
                            <div className="form-group mb-0">
                              <label className="form-label text-xs">
                                Barcode (EAN / Custom)
                              </label>
                              <div className="relative">
                                <Barcode className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={v.barcode}
                                  onChange={(e) => handleVariantChange(idx, 'barcode', e.target.value)}
                                  placeholder="e.g. 8901234567890"
                                  className="input-field text-xs py-1.5 pl-8 font-mono"
                                  disabled={isSaving}
                                />
                              </div>
                            </div>

                            {/* Conversion to Base */}
                            <div className="form-group mb-0">
                              <label className="form-label text-xs">
                                Conversion to Base Unit <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.0001"
                                  required
                                  value={v.conversion_to_base}
                                  onChange={(e) => handleVariantChange(idx, 'conversion_to_base', e.target.value)}
                                  placeholder="1"
                                  className="input-field text-xs py-1.5 pr-14"
                                  disabled={isSaving}
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                  {selectedUnitObj?.name || 'Base'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timestamp metadata */}
                  {product.created_at && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] pt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Created on {new Date(product.created_at).toLocaleString()}
                        {product.updated_at &&
                          ` • Last updated ${new Date(product.updated_at).toLocaleTimeString()}`}
                      </span>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Total Variants: <strong>{variants.length}</strong> (At least 1 required)
                    </span>

                    <div className="flex items-center gap-3">
                      <Link
                        href="/admin/products/dashboard"
                        className="btn btn-outline"
                      >
                        Cancel
                      </Link>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="btn btn-primary min-w-[130px]"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function OpenProductPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-brand-deep-green)]" />
        </div>
      }
    >
      <OpenProductContent />
    </Suspense>
  );
}
