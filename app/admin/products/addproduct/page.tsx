'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { addProduct, getCategories, Category, Product } from '@/lib/productsStore';
import { getUnits, Unit } from '@/lib/unitsStore';
import { addProductVariants, generateVariantCode } from '@/lib/productvariantsStore';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  PackagePlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Hash,
  Layers,
  Plus,
  Trash2,
  RefreshCw,
  Barcode,
  Layers3,
} from 'lucide-react';

interface VariantRow {
  keyId: string;
  variant_name: string;
  variant_code: string;
  barcode: string;
  conversion_to_base: number | string;
}

export default function AddProductPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  // Step indicator: 1 = Product Details, 2 = Product Variants
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);

  // Step 1: Product Form State
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [minimumStock, setMinimumStock] = useState<number | string>('10');
  const [quantity, setQuantity] = useState<number | string>('0');
  const [status, setStatus] = useState(true);

  // Options State
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Searchable Category dropdown
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);

  // Step 2: Product Variants State (Must have at least one variant)
  const [variants, setVariants] = useState<VariantRow[]>([
    {
      keyId: 'var-init-1',
      variant_name: 'Standard Packaging',
      variant_code: generateVariantCode(),
      barcode: '',
      conversion_to_base: '1',
    },
  ]);
  const [isSubmittingVariants, setIsSubmittingVariants] = useState(false);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdminAndOptions = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setLoadingOptions(true);
      const [cats, uns] = await Promise.all([getCategories(), getUnits()]);
      setCategories(cats);
      setUnits(uns);

      if (cats.length > 0) setCategoryId(cats[0].id);
      if (uns.length > 0) setBaseUnitId(uns[0].id);

      setLoadingOptions(false);
    };

    fetchAdminAndOptions();
  }, []);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())
    );
  }, [categories, categorySearchQuery]);

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);
  const selectedUnitObj = units.find((u) => u.id === baseUnitId);

  // Step 1: Save Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter a product name.');
      return;
    }
    if (!categoryId) {
      setError('Please select a product category.');
      return;
    }
    if (!baseUnitId) {
      setError('Please select a base unit of measurement.');
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

    setIsSubmittingProduct(true);

    try {
      // Auto-generates product_code as prod_(4 random numbers) and inserts into products table
      const { data, error: addErr } = await addProduct({
        name: cleanName,
        hsn_code: hsnCode.trim(),
        category_id: categoryId,
        base_unit_id: baseUnitId,
        minimum_stock: minStockNum,
        quantity: quantityNum,
        status,
      });

      if (addErr || !data) {
        setError(addErr || 'Failed to save product.');
        setIsSubmittingProduct(false);
        return;
      }

      setSavedProduct(data);
      // Pre-populate first variant name based on product
      setVariants([
        {
          keyId: 'var-init-1',
          variant_name: `${cleanName} - Base Unit`,
          variant_code: generateVariantCode(),
          barcode: '',
          conversion_to_base: '1',
        },
      ]);
      setSuccessMsg(`Product "${data.name}" (${data.product_code}) saved! Now add product packaging variants.`);
      setIsSubmittingProduct(false);
      setCurrentStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error creating product.';
      setError(msg);
      setIsSubmittingProduct(false);
    }
  };

  // Variant row controls
  const handleAddVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      {
        keyId: 'var-' + Math.random().toString(36).substring(2, 9),
        variant_name: '',
        variant_code: generateVariantCode(),
        barcode: '',
        conversion_to_base: '1',
      },
    ]);
  };

  const handleRemoveVariantRow = (index: number) => {
    if (variants.length <= 1) {
      setError('At least one product variant is required.');
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantFieldChange = (
    index: number,
    field: keyof VariantRow,
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleRegenerateVariantCode = (index: number) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, variant_code: generateVariantCode() } : v))
    );
  };

  // Step 2: Save Variants
  const handleSaveVariants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedProduct) return;

    setError(null);
    setSuccessMsg(null);

    if (variants.length === 0) {
      setError('Please add at least one product variant.');
      return;
    }

    // Validate all variants
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.variant_name.trim()) {
        setError(`Variant #${i + 1} must have a name.`);
        return;
      }
      if (!v.variant_code.trim()) {
        setError(`Variant #${i + 1} must have a variant code.`);
        return;
      }
      const conv = Number(v.conversion_to_base);
      if (isNaN(conv) || conv <= 0) {
        setError(`Variant "${v.variant_name || `#${i + 1}`}" conversion factor must be a number greater than 0.`);
        return;
      }
    }

    setIsSubmittingVariants(true);

    try {
      const { data, error: varErr } = await addProductVariants(
        savedProduct.id,
        variants.map((v) => ({
          product_id: savedProduct.id,
          variant_name: v.variant_name.trim(),
          variant_code: v.variant_code.trim(),
          barcode: v.barcode.trim() || undefined,
          conversion_to_base: Number(v.conversion_to_base),
          status: true,
        }))
      );

      if (varErr || !data) {
        setError(varErr || 'Failed to save product variants.');
        setIsSubmittingVariants(false);
        return;
      }

      setSuccessMsg(
        `Successfully saved ${data.length} variant(s) for "${savedProduct.name}". Redirecting to dashboard...`
      );

      setTimeout(() => {
        router.push('/admin/products/dashboard');
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving variants.';
      setError(msg);
      setIsSubmittingVariants(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      {/* Top Sticky Header */}
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
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header Breadcrumb / Navigation */}
            <div className="flex items-center justify-between">
              <Link
                href="/admin/products/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Store Products</span>
              </Link>

              {/* Step Pill */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    currentStep === 1
                      ? 'bg-[var(--color-brand-deep-green)] text-white border-[var(--color-brand-deep-green)]'
                      : 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] border-[var(--color-brand-deep-green)]'
                  }`}
                >
                  Step 1: Product Details
                </span>
                <span className="text-[var(--color-text-muted)]">→</span>
                <span
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    currentStep === 2
                      ? 'bg-[var(--color-brand-deep-green)] text-white border-[var(--color-brand-deep-green)]'
                      : 'bg-gray-100 text-[var(--color-text-muted)] border-gray-200'
                  }`}
                >
                  Step 2: Product Variants
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-danger)]" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-4 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2.5 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--color-brand-deep-green)]" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* STEP 1: Product Master Information */}
            {currentStep === 1 && (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 animate-fade-in">
                <div className="flex items-center gap-3 pb-6 border-b border-[var(--color-border)] mb-6">
                  <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <PackagePlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                      Add New Product
                    </h1>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                      Product code will be auto-generated in format <code>prod_XXXX</code>.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-5">
                  {/* Product Name */}
                  <div className="form-group mb-0">
                    <label htmlFor="product-name" className="form-label">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="product-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sona Masoori Rice (Special Brand)"
                      className="input-field text-sm"
                      disabled={isSubmittingProduct}
                      autoFocus
                    />
                  </div>

                  {/* HSN Code */}
                  <div className="form-group mb-0">
                    <label htmlFor="product-hsn-code" className="form-label">
                      HSN Code
                    </label>
                    <input
                      id="product-hsn-code"
                      type="text"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      placeholder="e.g. 10063020"
                      className="input-field text-sm font-mono"
                      disabled={isSubmittingProduct}
                    />
                  </div>

                  {/* Searchable Category Picker */}
                  <div className="form-group mb-0 relative">
                    <label htmlFor="product-category" className="form-label">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <button
                      id="product-category"
                      type="button"
                      onClick={() => setIsCategoryPickerOpen((prev) => !prev)}
                      className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)]"
                      disabled={isSubmittingProduct || loadingOptions}
                    >
                      <span className="text-sm truncate">
                        {selectedCategoryObj ? selectedCategoryObj.name : 'Select a category...'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">▼</span>
                    </button>

                    {/* Category Search Popover */}
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
                          {filteredCategories.length === 0 && (
                            <div className="p-3 text-center text-[var(--color-text-muted)]">
                              No categories found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <span className="small-text mt-1">Search and select the product classification.</span>
                  </div>

                  {/* Base Unit of Measurement */}
                  <div className="form-group mb-0">
                    <label htmlFor="product-unit" className="form-label">
                      Base Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="product-unit"
                      required
                      value={baseUnitId}
                      onChange={(e) => setBaseUnitId(e.target.value)}
                      className="select-field text-sm"
                      disabled={isSubmittingProduct || loadingOptions}
                    >
                      <option value="" disabled>Select base unit</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.use_name}
                        </option>
                      ))}
                    </select>
                    <span className="small-text mt-1">Base unit for inventory calculation (KG, Box, Liter, etc.).</span>
                  </div>

                  {/* Minimum Stock & Current Quantity in a 2-col row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Minimum Stock */}
                    <div className="form-group mb-0">
                      <label htmlFor="minimum-stock" className="form-label">
                        Minimum Stock Level <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="minimum-stock"
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={minimumStock}
                        onChange={(e) => setMinimumStock(e.target.value)}
                        placeholder="e.g. 10"
                        className="input-field text-sm"
                        disabled={isSubmittingProduct}
                      />
                      <span className="small-text mt-1">Threshold for low-stock alerts.</span>
                    </div>

                    {/* Quantity */}
                    <div className="form-group mb-0">
                      <label htmlFor="quantity" className="form-label">
                        Initial Quantity <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="quantity"
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g. 100"
                        className="input-field text-sm"
                        disabled={isSubmittingProduct}
                      />
                      <span className="small-text mt-1">Initial stock on hand.</span>
                    </div>
                  </div>

                  {/* Auto Product Code Banner */}
                  <div className="p-3.5 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex items-center gap-2 text-xs text-[var(--color-brand-deep-green)]">
                    <Hash className="w-4 h-4 shrink-0" />
                    <span>
                      A unique <strong>Product Code</strong> (e.g. <code>prod_XXXX</code>) will automatically be generated on save.
                    </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                    <Link
                      href="/admin/products/dashboard"
                      className="btn btn-outline"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={isSubmittingProduct}
                      className="btn btn-primary min-w-[140px]"
                    >
                      {isSubmittingProduct ? 'Saving...' : 'Save & Add Variants'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 2: Product Variants Section (Instructed: After Saving product also ask product_variants (variant_name, varaint_code, barcode, conversion_to_base) Allow to Add multiple varaints. make sure atleast one variant.) */}
            {currentStep === 2 && savedProduct && (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 animate-fade-in space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between pb-6 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                        Add Product Variants
                      </h1>
                      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                        Configure packaging variants (e.g. 1kg Bag, 25kg Sack, Box). At least one variant is required.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Variant</span>
                  </button>
                </div>

                {/* Saved Product Summary Banner */}
                <div className="p-4 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] font-medium">Product: </span>
                    <strong className="text-[var(--color-brand-deep-green)] text-sm">
                      {savedProduct.name}
                    </strong>
                    <span className="ml-2 font-mono px-2 py-0.5 rounded bg-[var(--color-brand-white)] border border-[var(--color-border-subtle)] font-semibold">
                      {savedProduct.product_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                    <span>Category: <strong>{savedProduct.category_name || selectedCategoryObj?.name || 'General'}</strong></span>
                    <span>•</span>
                    <span>Base Unit: <strong>{savedProduct.unit_name || selectedUnitObj?.name || 'Unit'}</strong></span>
                  </div>
                </div>

                {/* Variants Form */}
                <form onSubmit={handleSaveVariants} className="space-y-4">
                  <div className="space-y-4">
                    {variants.map((v, idx) => (
                      <div
                        key={v.keyId}
                        className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] space-y-3 relative group"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-brand-deep-green)] text-white text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                              Variant #{idx + 1}
                            </span>
                          </div>

                          {variants.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveVariantRow(idx)}
                              className="text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] p-1.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Delete variant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
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
                              onChange={(e) => handleVariantFieldChange(idx, 'variant_name', e.target.value)}
                              placeholder="e.g. 25 KG Bag, 1 KG Pouch, Carton"
                              className="input-field text-xs py-1.5"
                              disabled={isSubmittingVariants}
                            />
                          </div>

                          {/* Variant Code (auto-generated e.g. var_XXXX, allow edit or regenerate) */}
                          <div className="form-group mb-0">
                            <div className="flex items-center justify-between mb-1">
                              <label className="form-label text-xs mb-0">
                                Variant Code <span className="text-red-500">*</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRegenerateVariantCode(idx)}
                                className="text-[11px] text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                title="Generate new random code"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Regen</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              required
                              value={v.variant_code}
                              onChange={(e) => handleVariantFieldChange(idx, 'variant_code', e.target.value)}
                              placeholder="e.g. var_1234"
                              className="input-field text-xs py-1.5 font-mono font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
                              disabled={isSubmittingVariants}
                            />
                          </div>

                          {/* Barcode (optional) */}
                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Barcode (EAN / UPC / Custom)
                            </label>
                            <div className="relative">
                              <Barcode className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={v.barcode}
                                onChange={(e) => handleVariantFieldChange(idx, 'barcode', e.target.value)}
                                placeholder="e.g. 8901234567890"
                                className="input-field text-xs py-1.5 pl-8 font-mono"
                                disabled={isSubmittingVariants}
                              />
                            </div>
                          </div>

                          {/* Conversion to Base Unit */}
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
                                onChange={(e) => handleVariantFieldChange(idx, 'conversion_to_base', e.target.value)}
                                placeholder="1"
                                className="input-field text-xs py-1.5 pr-14"
                                disabled={isSubmittingVariants}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                {savedProduct.unit_name || selectedUnitObj?.name || 'Base'}
                              </span>
                            </div>
                            <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5 block">
                              1 variant contains how many base units (e.g. 25 for a 25kg bag).
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add variant button bottom */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleAddVariantRow}
                      className="w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-brand-deep-green)] text-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Another Packaging Variant</span>
                    </button>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Total Variants: <strong>{variants.length}</strong> (Minimum 1 required)
                    </span>

                    <button
                      type="submit"
                      disabled={isSubmittingVariants}
                      className="btn btn-primary min-w-[150px]"
                    >
                      {isSubmittingVariants ? 'Saving Variants...' : 'Save Variants & Finish'}
                    </button>
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
