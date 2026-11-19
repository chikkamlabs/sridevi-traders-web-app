'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getFirms, Firm } from '@/lib/firmsStore';
import { getSuppliers, Supplier } from '@/lib/suppliersStore';
import { getProducts, Product } from '@/lib/productsStore';
import { getAllProductVariants, ProductVariant } from '@/lib/productvariantsStore';
import {
  addPurchase,
  applyPurchaseStockAndMovements,
  generatePurchaseNumber,
  PurchaseItemInput,
} from '@/lib/purchasesStore';
import { recordPurchaseSupplierTransaction } from '@/lib/suppliertrasacationsStore';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  ShoppingCart,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Package,
} from 'lucide-react';

interface PurchaseItemRow {
  keyId: string;
  product_id: string;
  product_variant_id: string;
  quantity: string;
  conversion_factor: string;
  base_quantity: string;
  gst_unit_price: string;
  mrp: string;
  discount_rate: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  gst_total_price: string;
}

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyItemRow(): PurchaseItemRow {
  return {
    keyId: 'item-' + Math.random().toString(36).substring(2, 9),
    product_id: '',
    product_variant_id: '',
    quantity: '1',
    conversion_factor: '1',
    base_quantity: '1',
    gst_unit_price: '0',
    mrp: '0',
    discount_rate: '0',
    discount_amount: '0',
    tax_rate: '0',
    tax_amount: '0',
    gst_total_price: '0',
  };
}

function recalculateItemAmounts(row: PurchaseItemRow): PurchaseItemRow {
  const qty = Math.max(0, Number(row.quantity) || 0);
  const conv = Math.max(0, Number(row.conversion_factor) || 0);
  const baseQty = qty * conv;

  const unitPrice = Math.max(0, Number(row.gst_unit_price) || 0);
  const discRate = Math.min(100, Math.max(0, Number(row.discount_rate) || 0));
  const taxRate = Math.max(0, Number(row.tax_rate) || 0);

  const gross = qty * unitPrice;
  const discAmt = (gross * discRate) / 100;
  const taxable = Math.max(0, gross - discAmt);
  const taxAmt = (taxable * taxRate) / 100;
  const totalPrice = taxable + taxAmt;

  return {
    ...row,
    base_quantity: Number.isFinite(baseQty) ? String(Number(baseQty.toFixed(3))) : '0',
    discount_amount: discAmt.toFixed(2),
    tax_amount: taxAmt.toFixed(2),
    gst_total_price: totalPrice.toFixed(2),
  };
}

export default function AddPurchasePage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  // Master Data
  const [firms, setFirms] = useState<Firm[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Purchase Fields
  const [firmId, setFirmId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [gstSubtotal, setGstSubtotal] = useState('0.00');
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [extraCharges, setExtraCharges] = useState('0.00');
  const [gstTotal, setGstTotal] = useState('0.00');
  const [notes, setNotes] = useState('');

  // Searchable Firm Picker
  const [firmSearch, setFirmSearch] = useState('');
  const [isFirmPickerOpen, setIsFirmPickerOpen] = useState(false);

  // Searchable Supplier Picker
  const [supplierSearch, setSupplierSearch] = useState('');
  const [isSupplierPickerOpen, setIsSupplierPickerOpen] = useState(false);

  // Purchase Items
  const [items, setItems] = useState<PurchaseItemRow[]>([createEmptyItemRow()]);
  const [openProductPickerKey, setOpenProductPickerKey] = useState<string | null>(null);
  const [productSearchByRow, setProductSearchByRow] = useState<Record<string, string>>({});

  // Submission State
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadInitial = async () => {
      const [firmsData, suppliersData, productsData, variantsData] = await Promise.all([
        getFirms(),
        getSuppliers(),
        getProducts(),
        getAllProductVariants(),
      ]);

      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setPurchaseNumber((prev) => prev || generatePurchaseNumber());
      setFirms(firmsData);
      setSuppliers(suppliersData);
      setProducts(productsData);
      setAllVariants(variantsData);

      if (firmsData.length > 0) setFirmId(firmsData[0].id);
      if (suppliersData.length > 0) setSupplierId(suppliersData[0].id);

      setLoadingOptions(false);
    };

    loadInitial();
  }, []);

  const syncTotalsFromItems = (nextItems: PurchaseItemRow[]) => {
    let subTotalSum = 0;
    let taxSum = 0;
    let totalSum = 0;

    for (const item of nextItems) {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Math.max(0, Number(item.gst_unit_price) || 0);
      const discAmt = Math.max(0, Number(item.discount_amount) || 0);
      const itemTax = Math.max(0, Number(item.tax_amount) || 0);
      const itemTotal = Math.max(0, Number(item.gst_total_price) || 0);

      subTotalSum += Math.max(0, qty * unitPrice - discAmt);
      taxSum += itemTax;
      totalSum += itemTotal;
    }

    const extraNum = Math.max(0, Number(extraCharges) || 0);
    setGstSubtotal(subTotalSum.toFixed(2));
    setTaxAmount(taxSum.toFixed(2));
    setGstTotal((totalSum + extraNum).toFixed(2));
  };

  const handleExtraChargesChange = (value: string) => {
    setExtraCharges(value);
    const extraNum = Math.max(0, Number(value) || 0);
    const subNum = Math.max(0, Number(gstSubtotal) || 0);
    const taxNum = Math.max(0, Number(taxAmount) || 0);
    setGstTotal((subNum + taxNum + extraNum).toFixed(2));
  };

  const filteredFirms = useMemo(() => {
    const q = firmSearch.trim().toLowerCase();
    if (!q) return firms;
    return firms.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.gst_number && f.gst_number.toLowerCase().includes(q))
    );
  }, [firms, firmSearch]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.supplier_code.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  const selectedFirm = firms.find((f) => f.id === firmId);
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const handleAddItemRow = () => {
    const next = [...items, createEmptyItemRow()];
    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) {
      setError('At least one product item is required for a purchase.');
      return;
    }
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleSelectProduct = (rowIndex: number, productId: string) => {
    const prodVariants = allVariants.filter((v) => v.product_id === productId);
    const defaultVariant = prodVariants[0];

    const next = items.map((row, idx) => {
      if (idx !== rowIndex) return row;
      const conv = defaultVariant ? String(defaultVariant.conversion_to_base) : '1';
      const updated: PurchaseItemRow = {
        ...row,
        product_id: productId,
        product_variant_id: defaultVariant ? defaultVariant.id : '',
        conversion_factor: conv,
      };
      return recalculateItemAmounts(updated);
    });

    setItems(next);
    syncTotalsFromItems(next);
    setOpenProductPickerKey(null);
  };

  const handleSelectVariant = (rowIndex: number, variantId: string) => {
    const variant = allVariants.find((v) => v.id === variantId);
    const next = items.map((row, idx) => {
      if (idx !== rowIndex) return row;
      const conv = variant ? String(variant.conversion_to_base) : row.conversion_factor;
      const updated: PurchaseItemRow = {
        ...row,
        product_variant_id: variantId,
        conversion_factor: conv,
      };
      return recalculateItemAmounts(updated);
    });

    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleItemFieldChange = (
    rowIndex: number,
    field: keyof PurchaseItemRow,
    value: string
  ) => {
    const next = items.map((row, idx) => {
      if (idx !== rowIndex) return row;
      const updated = { ...row, [field]: value };

      // Fields that drive auto-calculation
      if (
        field === 'quantity' ||
        field === 'conversion_factor' ||
        field === 'gst_unit_price' ||
        field === 'discount_rate' ||
        field === 'tax_rate'
      ) {
        return recalculateItemAmounts(updated);
      }

      // If user manually edits discount_amount or tax_amount, recalculate total_price
      if (field === 'discount_amount' || field === 'tax_amount') {
        const qty = Math.max(0, Number(updated.quantity) || 0);
        const unitPrice = Math.max(0, Number(updated.gst_unit_price) || 0);
        const discAmt = Math.max(0, Number(updated.discount_amount) || 0);
        const taxAmt = Math.max(0, Number(updated.tax_amount) || 0);
        const total = Math.max(0, qty * unitPrice - discAmt) + taxAmt;
        return {
          ...updated,
          gst_total_price: total.toFixed(2),
        };
      }

      return updated;
    });

    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!firmId) {
      setError('Please select a firm.');
      return;
    }
    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Please enter the invoice number.');
      return;
    }
    if (!purchaseNumber.trim()) {
      setError('Purchase number is required.');
      return;
    }
    if (!date) {
      setError('Please select a purchase date.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one product item.');
      return;
    }

    const preparedItems: PurchaseItemInput[] = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row.product_id) {
        setError(`Item #${i + 1}: Please select a product.`);
        return;
      }
      if (!row.product_variant_id) {
        setError(`Item #${i + 1}: Please select a product variant.`);
        return;
      }
      const qty = Number(row.quantity);
      const conv = Number(row.conversion_factor);
      const baseQty = Number(row.base_quantity);
      const unitPrice = Number(row.gst_unit_price);
      const mrpVal = Number(row.mrp);
      const discRate = Number(row.discount_rate);
      const discAmt = Number(row.discount_amount);
      const tRate = Number(row.tax_rate);
      const tAmt = Number(row.tax_amount);
      const totalPrice = Number(row.gst_total_price);

      if (isNaN(qty) || qty <= 0) {
        setError(`Item #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      if (isNaN(conv) || conv <= 0) {
        setError(`Item #${i + 1}: Conversion factor must be greater than 0.`);
        return;
      }
      if (isNaN(baseQty) || baseQty <= 0) {
        setError(`Item #${i + 1}: Base quantity must be greater than 0.`);
        return;
      }

      preparedItems.push({
        product_id: row.product_id,
        product_variant_id: row.product_variant_id,
        quantity: qty,
        conversion_factor: conv,
        base_quantity: baseQty,
        gst_unit_price: isNaN(unitPrice) ? 0 : unitPrice,
        mrp: isNaN(mrpVal) ? 0 : mrpVal,
        discount_rate: isNaN(discRate) ? 0 : discRate,
        discount_amount: isNaN(discAmt) ? 0 : discAmt,
        tax_rate: isNaN(tRate) ? 0 : tRate,
        tax_amount: isNaN(tAmt) ? 0 : tAmt,
        gst_total_price: isNaN(totalPrice) ? 0 : totalPrice,
      });
    }

    const totalNum = Number(gstTotal);
    const subtotalNum = Number(gstSubtotal);
    const taxNum = Number(taxAmount);
    const extraChargesNum = Math.max(0, Number(extraCharges) || 0);

    if (isNaN(totalNum) || totalNum <= 0) {
      setError('Total (gst_total) must be greater than 0.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Insert purchase & purchase_items
      const { data: savedPurchase, error: purchaseErr } = await addPurchase(
        {
          firm_id: firmId,
          supplier_id: supplierId,
          invoice_number: invoiceNumber.trim(),
          purchase_number: purchaseNumber.trim(),
          date,
          gst_subtotal: isNaN(subtotalNum) ? 0 : subtotalNum,
          tax_amount: isNaN(taxNum) ? 0 : taxNum,
          extra_charges: isNaN(extraChargesNum) ? 0 : extraChargesNum,
          gst_total: totalNum,
          grand_total: totalNum,
          notes: notes.trim(),
        },
        preparedItems
      );

      if (purchaseErr || !savedPurchase) {
        setError(purchaseErr || 'Failed to save purchase.');
        setIsSaving(false);
        return;
      }

      // 2. Insert supplier_transactions (transaction_type = 'purchase', payment_method = 'NA', amount = gst_total)
      //    and increment firm_supplier_balances.gst_balance
      const { error: txErr } = await recordPurchaseSupplierTransaction({
        firm_id: firmId,
        supplier_id: supplierId,
        purchase_id: savedPurchase.id,
        purchase_number: savedPurchase.purchase_number,
        invoice_number: savedPurchase.invoice_number,
        amount: totalNum,
        transaction_date: date,
        notes: notes.trim() || undefined,
      });

      if (txErr) {
        setError(txErr);
        setIsSaving(false);
        return;
      }

      // 3. Update products.quantity (+ base_quantity) and insert stock_movements (movement_type = 'in', remaining_quantity = products.quantity + base_quantity, reference_type = 'purchase')
      const { error: stockErr } = await applyPurchaseStockAndMovements({
        firm_id: firmId,
        purchase_id: savedPurchase.id,
        purchase_number: savedPurchase.purchase_number,
        items: preparedItems,
      });

      if (stockErr) {
        setError(stockErr);
        setIsSaving(false);
        return;
      }

      setSuccessMsg(
        `Purchase ${savedPurchase.purchase_number} saved and supplier balance updated! Redirecting...`
      );
      setIsSaving(false);

      setTimeout(() => {
        router.push('/admin/purchases/dashboard');
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving purchase.';
      setError(msg);
      setIsSaving(false);
    }
  };

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
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Back Navigation */}
            <div className="flex items-center justify-between">
              <Link
                href="/admin/purchases/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Purchases</span>
              </Link>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-danger)]" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Banner */}
            {successMsg && (
              <div className="p-4 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2.5 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--color-brand-deep-green)]" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSavePurchase} className="space-y-6">
              {/* Purchases Master Card */}
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-5 border-b border-[var(--color-border)]">
                  <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                      Add Purchase
                    </h1>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                      Enter purchase bill details, add items, and automatically update supplier ledger balances.
                    </p>
                  </div>
                </div>

                {/* Row 1: Firm (Search & Select) and Supplier (Search & Select) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Firm Picker */}
                  <div className="form-group mb-0 relative">
                    <label className="form-label">
                      Firm <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFirmPickerOpen((prev) => !prev);
                        setIsSupplierPickerOpen(false);
                      }}
                      disabled={isSaving || loadingOptions}
                      className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)] cursor-pointer"
                    >
                      <span className="text-sm truncate">
                        {selectedFirm ? selectedFirm.name : 'Select a firm...'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">▼</span>
                    </button>

                    {isFirmPickerOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                        <div className="relative mb-2">
                          <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={firmSearch}
                            onChange={(e) => setFirmSearch(e.target.value)}
                            placeholder="Search firms..."
                            className="input-field py-1.5 pl-8 text-xs"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                          {filteredFirms.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setFirmId(f.id);
                                setIsFirmPickerOpen(false);
                                setFirmSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                                firmId === f.id
                                  ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                  : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div>{f.name}</div>
                              {f.gst_number && (
                                <div className="text-[11px] text-[var(--color-text-muted)]">
                                  GST: {f.gst_number}
                                </div>
                              )}
                            </button>
                          ))}
                          {filteredFirms.length === 0 && (
                            <div className="p-3 text-center text-[var(--color-text-muted)]">
                              No firms found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supplier Picker */}
                  <div className="form-group mb-0 relative">
                    <label className="form-label">
                      Supplier <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSupplierPickerOpen((prev) => !prev);
                        setIsFirmPickerOpen(false);
                      }}
                      disabled={isSaving || loadingOptions}
                      className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)] cursor-pointer"
                    >
                      <span className="text-sm truncate">
                        {selectedSupplier
                          ? `${selectedSupplier.name} (${selectedSupplier.supplier_code})`
                          : 'Select a supplier...'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">▼</span>
                    </button>

                    {isSupplierPickerOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                        <div className="relative mb-2">
                          <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                            placeholder="Search suppliers..."
                            className="input-field py-1.5 pl-8 text-xs"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                          {filteredSuppliers.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSupplierId(s.id);
                                setIsSupplierPickerOpen(false);
                                setSupplierSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                                supplierId === s.id
                                  ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                  : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div>{s.name}</div>
                              <div className="text-[11px] text-[var(--color-text-muted)]">
                                {s.supplier_code}
                              </div>
                            </button>
                          ))}
                          {filteredSuppliers.length === 0 && (
                            <div className="p-3 text-center text-[var(--color-text-muted)]">
                              No suppliers found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Purchase Number, Invoice Number, Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Purchase Number (auto filled purchase_XXXX) */}
                  <div className="form-group mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="purchase-number" className="form-label mb-0">
                        Purchase Number <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setPurchaseNumber(generatePurchaseNumber())}
                        className="text-[11px] text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        title="Generate new purchase number"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regen</span>
                      </button>
                    </div>
                    <input
                      id="purchase-number"
                      type="text"
                      required
                      value={purchaseNumber}
                      onChange={(e) => setPurchaseNumber(e.target.value)}
                      className="input-field text-sm font-mono font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Invoice Number */}
                  <div className="form-group mb-0">
                    <label htmlFor="invoice-number" className="form-label">
                      Invoice Number <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="invoice-number"
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="e.g. INV-2026-001"
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Date */}
                  <div className="form-group mb-0">
                    <label htmlFor="purchase-date" className="form-label">
                      Date <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="purchase-date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Row 3: Subtotal (gst_subtotal), Tax Amount, Extra Charges, Total (gst_total) */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="form-group mb-0">
                    <label htmlFor="gst-subtotal" className="form-label">
                      Subtotal (gst_subtotal) <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="gst-subtotal"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={gstSubtotal}
                      onChange={(e) => setGstSubtotal(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="tax-amount" className="form-label">
                      Tax Amount <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="tax-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="extra-charges" className="form-label">
                      Extra Charges
                    </label>
                    <input
                      id="extra-charges"
                      type="number"
                      step="0.01"
                      min="0"
                      value={extraCharges}
                      onChange={(e) => handleExtraChargesChange(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="gst-total" className="form-label">
                      Total (gst_total) <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="gst-total"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={gstTotal}
                      onChange={(e) => setGstTotal(e.target.value)}
                      className="input-field text-sm font-bold text-[var(--color-brand-deep-green)]"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group mb-0">
                  <label htmlFor="purchase-notes" className="form-label">
                    Notes
                  </label>
                  <textarea
                    id="purchase-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional purchase notes, transport details, or remarks..."
                    className="textarea-field text-sm min-h-[4.5rem]"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Purchase Items Card */}
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                        Purchase Items
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Search and select products, pick variants, and enter pricing & taxes.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    disabled={isSaving}
                    className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((row, idx) => {
                    const selectedProduct = products.find((p) => p.id === row.product_id);
                    const rowVariants = allVariants.filter(
                      (v) => v.product_id === row.product_id
                    );
                    const rowSearch = productSearchByRow[row.keyId] || '';
                    const filteredProducts = rowSearch.trim()
                      ? products.filter(
                          (p) =>
                            p.name.toLowerCase().includes(rowSearch.trim().toLowerCase()) ||
                            p.product_code
                              .toLowerCase()
                              .includes(rowSearch.trim().toLowerCase())
                        )
                      : products;

                    return (
                      <div
                        key={row.keyId}
                        className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] space-y-4"
                      >
                        {/* Item Row Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-brand-deep-green)] text-[var(--color-text-inverse)] text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                              Item #{idx + 1}
                            </span>
                          </div>

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={isSaving}
                              className="text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] p-1.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>

                        {/* Product (Search & Select) and Product Variant */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Searchable Product Selector */}
                          <div className="form-group mb-0 relative">
                            <label className="form-label text-xs">
                              Product <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenProductPickerKey((prev) =>
                                  prev === row.keyId ? null : row.keyId
                                )
                              }
                              disabled={isSaving || loadingOptions}
                              className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)] py-1.5 text-xs cursor-pointer"
                            >
                              <span className="truncate">
                                {selectedProduct
                                  ? `${selectedProduct.name} (${selectedProduct.product_code})`
                                  : 'Search & select product...'}
                              </span>
                              <span className="text-[10px] text-[var(--color-text-muted)]">▼</span>
                            </button>

                            {openProductPickerKey === row.keyId && (
                              <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                                <div className="relative mb-2">
                                  <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                                  <input
                                    type="text"
                                    value={rowSearch}
                                    onChange={(e) =>
                                      setProductSearchByRow((prev) => ({
                                        ...prev,
                                        [row.keyId]: e.target.value,
                                      }))
                                    }
                                    placeholder="Search product name or code..."
                                    className="input-field py-1.5 pl-8 text-xs"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                                  {filteredProducts.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleSelectProduct(idx, p.id)}
                                      className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                                        row.product_id === p.id
                                          ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                          : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                                      }`}
                                    >
                                      <div>{p.name}</div>
                                      <div className="text-[11px] text-[var(--color-text-muted)]">
                                        {p.product_code} • {p.unit_name || 'Unit'}
                                      </div>
                                    </button>
                                  ))}
                                  {filteredProducts.length === 0 && (
                                    <div className="p-3 text-center text-[var(--color-text-muted)]">
                                      No products found
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Product Variant Selector */}
                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Product Variant <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <select
                              required
                              value={row.product_variant_id}
                              onChange={(e) => handleSelectVariant(idx, e.target.value)}
                              disabled={isSaving || !row.product_id}
                              className="select-field text-xs py-1.5"
                            >
                              <option value="">
                                {row.product_id
                                  ? rowVariants.length > 0
                                    ? 'Select variant...'
                                    : 'No variants available'
                                  : 'Select product first'}
                              </option>
                              {rowVariants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.variant_name} ({v.variant_code}) — Conv: {v.conversion_to_base}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Quantity, Conversion Factor, Base Quantity, Unit Price, MRP */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Quantity <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              required
                              value={row.quantity}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'quantity', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Conversion Factor
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.0001"
                              required
                              value={row.conversion_factor}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'conversion_factor', e.target.value)
                              }
                              className="input-field text-xs py-1.5 bg-[var(--color-surface-hover)]"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Base Quantity
                            </label>
                            <input
                              type="number"
                              step="any"
                              readOnly
                              value={row.base_quantity}
                              className="input-field text-xs py-1.5 bg-[var(--color-surface-muted)] font-semibold text-[var(--color-brand-deep-green)]"
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Unit Price (GST) <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={row.gst_unit_price}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'gst_unit_price', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">MRP</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.mrp}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'mrp', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>
                        </div>

                        {/* Discount Rate, Discount Amount, Tax Rate, Tax Amount, Total Price */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Discount Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={row.discount_rate}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'discount_rate', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Discount Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.discount_amount}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'discount_amount', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Tax Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.tax_rate}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'tax_rate', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Tax Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.tax_amount}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'tax_amount', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Total Price (GST) <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={row.gst_total_price}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'gst_total_price', e.target.value)
                              }
                              className="input-field text-xs py-1.5 font-bold text-[var(--color-brand-deep-green)] bg-[var(--color-primary-light)]"
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Another Product Button */}
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-brand-deep-green)] text-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Product</span>
                </button>

                {/* Save & Cancel Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    Items: <strong className="text-[var(--color-text-primary)]">{items.length}</strong> • Total Amount:{' '}
                    <strong className="text-[var(--color-brand-deep-green)] text-sm">
                      ₹{Number(gstTotal || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href="/admin/purchases/dashboard"
                      className="btn btn-outline"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn btn-primary min-w-[150px]"
                    >
                      {isSaving ? 'Saving...' : 'Save Purchase'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
