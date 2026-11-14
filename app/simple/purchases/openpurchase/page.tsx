'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SimpleHeader from '@/components/simple/header';
import SimpleSidebar from '@/components/simple/sidebar';
import {
  getSimplePurchaseById,
  updateSimplePurchaseNGst,
  SimplePurchase,
} from '@/lib/simple/npurchasesStore';
import { recordSimplePurchaseSupplierTransaction } from '@/lib/simple/nsuppliertrasacationsStore';
import { getSimpleUserProfile } from '@/lib/secretProfile';
import {
  ArrowLeft,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Building2,
  Truck,
  Package,
  FileText,
  Save,
} from 'lucide-react';

interface EditableItemState {
  id: string;
  n_gst_unit_price: string;
  n_gst_total_price: string;
}

function formatCurrency(val: number): string {
  return `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SimpleOpenPurchaseContent() {
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get('id');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [simpleName, setSimpleName] = useState('');
  const [purchase, setPurchase] = useState<SimplePurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable N-GST purchase fields
  const [nGstSubtotal, setNGstSubtotal] = useState('0.00');
  const [nGstTotal, setNGstTotal] = useState('0.00');
  const [editableItems, setEditableItems] = useState<Record<string, EditableItemState>>({});

  useEffect(() => {
    const fetchPurchaseDetails = async () => {
      const profile = await getSimpleUserProfile();
      if (profile?.name) {
        setSimpleName(profile.name);
      } else if (profile?.email) {
        const prefix = profile.email.split('@')[0];
        setSimpleName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      if (!purchaseId) {
        setError('No purchase ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await getSimplePurchaseById(purchaseId);
      if (data) {
        setPurchase(data);
        setNGstSubtotal(Number(data.n_gst_subtotal || 0).toFixed(2));
        setNGstTotal(Number(data.n_gst_total || 0).toFixed(2));

        const itemsState: Record<string, EditableItemState> = {};
        for (const item of data.items || []) {
          itemsState[item.id] = {
            id: item.id,
            n_gst_unit_price: Number(item.n_gst_unit_price || 0).toFixed(2),
            n_gst_total_price: Number(item.n_gst_total_price || 0).toFixed(2),
          };
        }
        setEditableItems(itemsState);
      } else {
        setError('Purchase not found.');
      }
      setLoading(false);
    };

    fetchPurchaseDetails();
  }, [purchaseId]);

  const recalcPurchaseNGstTotals = (nextItemsMap: Record<string, EditableItemState>) => {
    const sum = Object.values(nextItemsMap).reduce(
      (acc, it) => acc + (Number(it.n_gst_total_price) || 0),
      0
    );
    setNGstSubtotal(sum.toFixed(2));
    setNGstTotal(sum.toFixed(2));
  };

  const handleItemUnitPriceChange = (itemId: string, quantity: number, value: string) => {
    const unitPrice = Math.max(0, Number(value) || 0);
    const totalPrice = (quantity * unitPrice).toFixed(2);

    const nextMap: Record<string, EditableItemState> = {
      ...editableItems,
      [itemId]: {
        id: itemId,
        n_gst_unit_price: value,
        n_gst_total_price: totalPrice,
      },
    };
    setEditableItems(nextMap);
    recalcPurchaseNGstTotals(nextMap);
  };

  const handleItemTotalPriceChange = (itemId: string, value: string) => {
    const current = editableItems[itemId] || {
      id: itemId,
      n_gst_unit_price: '0.00',
      n_gst_total_price: '0.00',
    };
    const nextMap: Record<string, EditableItemState> = {
      ...editableItems,
      [itemId]: {
        ...current,
        n_gst_total_price: value,
      },
    };
    setEditableItems(nextMap);
    recalcPurchaseNGstTotals(nextMap);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

    setError(null);
    setSuccessMsg(null);

    const parsedSubtotal = Number(nGstSubtotal || 0);
    const parsedTotal = Number(nGstTotal || 0);

    if (isNaN(parsedSubtotal) || parsedSubtotal < 0) {
      setError('N-GST Subtotal must be a valid non-negative number.');
      return;
    }

    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setError('N-GST Total must be greater than 0 to record the supplier transaction.');
      return;
    }

    const itemsPayload = (purchase.items || []).map((item) => {
      const edited = editableItems[item.id];
      return {
        id: item.id,
        n_gst_unit_price: Math.max(0, Number(edited?.n_gst_unit_price || 0)),
        n_gst_total_price: Math.max(0, Number(edited?.n_gst_total_price || 0)),
      };
    });

    setIsSaving(true);

    // 1. Update purchases (n_gst_subtotal, n_gst_total) and purchase_items (n_gst_unit_price, n_gst_total_price)
    const updateRes = await updateSimplePurchaseNGst({
      purchaseId: purchase.id,
      n_gst_subtotal: parsedSubtotal,
      n_gst_total: parsedTotal,
      items: itemsPayload,
    });

    if (!updateRes.success) {
      setError(updateRes.error || 'Failed to update N-GST purchase amounts.');
      setIsSaving(false);
      return;
    }

    // 2. Insert into supplier_transactions (transaction_type = purchase, payment_method = NA, amount = n_gst_total, tax_mode = n_gst)
    //    and update firm_supplier_balances.n_gst_balance = firm_supplier_balances.n_gst_balance + amount
    const txRes = await recordSimplePurchaseSupplierTransaction({
      firm_id: purchase.firm_id,
      supplier_id: purchase.supplier_id,
      purchase_id: purchase.id,
      purchase_number: purchase.purchase_number,
      invoice_number: purchase.invoice_number,
      amount: parsedTotal,
      transaction_date: purchase.date,
      notes: purchase.notes,
    });

    if (txRes.error) {
      setError(txRes.error);
      setIsSaving(false);
      return;
    }

    // Refresh displayed purchase data
    const refreshed = await getSimplePurchaseById(purchase.id);
    if (refreshed) {
      setPurchase(refreshed);
      setNGstSubtotal(Number(refreshed.n_gst_subtotal || 0).toFixed(2));
      setNGstTotal(Number(refreshed.n_gst_total || 0).toFixed(2));
    }

    setSuccessMsg('N-GST purchase details, supplier transaction, and supplier N-GST balance saved successfully.');
    setIsSaving(false);
  };

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
            {/* Back link */}
            <div className="flex items-center justify-between">
              <Link
                href="/simple/purchases"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Purchases</span>
              </Link>
            </div>

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

            {loading ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-12 text-center text-[var(--color-text-muted)]">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[var(--color-brand-deep-green)]" />
                <span>Loading purchase details...</span>
              </div>
            ) : !purchase ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-danger-text)]">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[var(--color-danger)]" />
                <p className="font-semibold">{error || 'Purchase could not be found.'}</p>
                <Link
                  href="/simple/purchases"
                  className="btn btn-outline btn-sm mt-4 inline-flex"
                >
                  Return to Purchases
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                {/* Purchases Table Details Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                            Purchase Details
                          </h1>
                          <span className="px-2.5 py-0.5 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-xs font-semibold text-[var(--color-brand-deep-green)]">
                            {purchase.purchase_number}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                          Invoice Number: <strong className="text-[var(--color-text-primary)]">{purchase.invoice_number}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="px-4 py-2.5 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] text-right">
                      <div className="text-xs text-[var(--color-text-secondary)]">Total (N-GST)</div>
                      <div className="text-lg font-bold text-[var(--color-brand-deep-green)]">
                        {formatCurrency(Number(nGstTotal || 0))}
                      </div>
                    </div>
                  </div>

                  {/* Primary Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Firm</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {purchase.firm_name || purchase.firm_id}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Supplier</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {purchase.supplier_name || purchase.supplier_id}
                      </div>
                      {purchase.supplier_code && (
                        <div className="text-xs font-mono text-[var(--color-text-muted)]">
                          {purchase.supplier_code}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Purchase / Invoice No.</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {purchase.purchase_number}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Inv: {purchase.invoice_number}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Purchase Date</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {purchase.date}
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary from purchases table (N-GST fields editable) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Subtotal</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(purchase.gst_subtotal)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-brand-white)] border border-[var(--color-brand-soft-green)]">
                      <label htmlFor="n-gst-subtotal" className="text-[11px] font-semibold text-[var(--color-brand-deep-green)] block mb-1">
                        N-GST Subtotal
                      </label>
                      <input
                        id="n-gst-subtotal"
                        type="number"
                        step="0.01"
                        min="0"
                        value={nGstSubtotal}
                        onChange={(e) => setNGstSubtotal(e.target.value)}
                        className="input-field py-1 px-2 text-sm font-semibold"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">Tax Amount</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(purchase.tax_amount)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Total</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(purchase.gst_total)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-brand-deep-green)]">
                      <label htmlFor="n-gst-total" className="text-[11px] font-semibold text-[var(--color-brand-deep-green)] block mb-1">
                        N-GST Total
                      </label>
                      <input
                        id="n-gst-total"
                        type="number"
                        step="0.01"
                        min="0"
                        value={nGstTotal}
                        onChange={(e) => setNGstTotal(e.target.value)}
                        className="input-field py-1 px-2 text-sm font-bold text-[var(--color-brand-deep-green)]"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-brand-light-green)] border border-[var(--color-brand-soft-green)]">
                      <div className="text-[11px] text-[var(--color-brand-deep-green)]">Grand Total</div>
                      <div className="text-sm font-bold text-[var(--color-brand-deep-green)] mt-0.5">
                        {formatCurrency(purchase.grand_total)}
                      </div>
                    </div>
                  </div>

                  {/* Notes & Timestamps */}
                  <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
                    <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Notes</div>
                    <p className="text-sm text-[var(--color-text-primary)] bg-[var(--color-background)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
                      {purchase.notes || 'No notes recorded for this purchase.'}
                    </p>
                  </div>

                  {purchase.created_at && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Created on {new Date(purchase.created_at).toLocaleString()}
                        {purchase.updated_at &&
                          ` • Last updated ${new Date(purchase.updated_at).toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Purchase Items Table Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                          Purchase Items
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Edit N-GST Unit Price and N-GST Total Price for each item.
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-primary">
                      {purchase.items?.length || 0} Items
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                        <tr>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">Variant</th>
                          <th className="py-3 px-4 text-right">Qty</th>
                          <th className="py-3 px-4 text-right">Conv. Factor</th>
                          <th className="py-3 px-4 text-right">Base Qty</th>
                          <th className="py-3 px-4 text-right">Unit Price (GST)</th>
                          <th className="py-3 px-4 text-right">MRP</th>
                          <th className="py-3 px-4 text-right">Disc. Rate</th>
                          <th className="py-3 px-4 text-right">Disc. Amt</th>
                          <th className="py-3 px-4 text-right">Tax Rate</th>
                          <th className="py-3 px-4 text-right">Tax Amt</th>
                          <th className="py-3 px-4 text-right">Total Price (GST)</th>
                          <th className="py-3 px-4 text-right">N-GST Unit Price</th>
                          <th className="py-3 px-4 text-right">N-GST Total Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {!purchase.items || purchase.items.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="py-10 text-center text-[var(--color-text-muted)]">
                              No items found for this purchase.
                            </td>
                          </tr>
                        ) : (
                          purchase.items.map((item) => {
                            const editState = editableItems[item.id] || {
                              id: item.id,
                              n_gst_unit_price: Number(item.n_gst_unit_price || 0).toFixed(2),
                              n_gst_total_price: Number(item.n_gst_total_price || 0).toFixed(2),
                            };

                            return (
                              <tr
                                key={item.id}
                                className="hover:bg-[var(--color-surface-hover)] transition-colors"
                              >
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-[var(--color-text-primary)]">
                                    {item.product_name || item.product_id}
                                  </div>
                                  {item.product_code && (
                                    <div className="text-[11px] font-mono text-[var(--color-brand-deep-green)]">
                                      {item.product_code}
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="text-[var(--color-text-primary)]">
                                    {item.variant_name || item.product_variant_id}
                                  </div>
                                  {item.variant_code && (
                                    <div className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                      {item.variant_code}
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 text-right font-medium text-[var(--color-text-primary)]">
                                  {item.quantity}
                                </td>

                                <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                  {item.conversion_factor}
                                </td>

                                <td className="py-3.5 px-4 text-right font-semibold text-[var(--color-brand-deep-green)]">
                                  {item.base_quantity}
                                  {item.base_unit_name ? ` ${item.base_unit_name}` : ''}
                                </td>

                                <td className="py-3.5 px-4 text-right text-[var(--color-text-primary)]">
                                  {formatCurrency(item.gst_unit_price)}
                                </td>

                                <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                  {formatCurrency(item.mrp)}
                                </td>

                                <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                  {item.discount_rate}%
                                </td>

                                <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                  {formatCurrency(item.discount_amount)}
                                </td>

                                <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                  {item.tax_rate}%
                                </td>

                                <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                  {formatCurrency(item.tax_amount)}
                                </td>

                                <td className="py-3.5 px-4 text-right font-semibold text-[var(--color-text-primary)]">
                                  {formatCurrency(item.gst_total_price)}
                                </td>

                                <td className="py-3.5 px-4 text-right min-w-[130px]">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    aria-label={`N-GST Unit Price for ${item.product_name || 'item'}`}
                                    value={editState.n_gst_unit_price}
                                    onChange={(e) =>
                                      handleItemUnitPriceChange(item.id, item.quantity, e.target.value)
                                    }
                                    className="input-field py-1.5 px-2.5 text-right text-sm min-w-[110px]"
                                    disabled={isSaving}
                                  />
                                </td>

                                <td className="py-3.5 px-4 text-right min-w-[130px]">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    aria-label={`N-GST Total Price for ${item.product_name || 'item'}`}
                                    value={editState.n_gst_total_price}
                                    onChange={(e) =>
                                      handleItemTotalPriceChange(item.id, e.target.value)
                                    }
                                    className="input-field py-1.5 px-2.5 text-right text-sm font-semibold text-[var(--color-brand-deep-green)] min-w-[110px]"
                                    disabled={isSaving}
                                  />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn btn-primary inline-flex items-center gap-2 min-w-[160px]"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SimpleOpenPurchasePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-brand-deep-green)]" />
        </div>
      }
    >
      <SimpleOpenPurchaseContent />
    </Suspense>
  );
}
