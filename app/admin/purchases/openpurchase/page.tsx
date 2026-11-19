'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getPurchaseById, Purchase } from '@/lib/purchasesStore';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  ShoppingCart,
  AlertCircle,
  RefreshCw,
  Calendar,
  Building2,
  Truck,
  Package,
  FileText,
} from 'lucide-react';

function formatCurrency(val: number): string {
  return `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function OpenPurchaseContent() {
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get('id');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPurchaseDetails = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      if (!purchaseId) {
        setError('No purchase ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await getPurchaseById(purchaseId);
      if (data) {
        setPurchase(data);
      } else {
        setError('Purchase not found.');
      }
      setLoading(false);
    };

    fetchPurchaseDetails();
  }, [purchaseId]);

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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Back link */}
            <div className="flex items-center justify-between">
              <Link
                href="/admin/purchases/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Purchases</span>
              </Link>
            </div>

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
                  href="/admin/purchases/dashboard"
                  className="btn btn-outline btn-sm mt-4 inline-flex"
                >
                  Return to Purchases
                </Link>
              </div>
            ) : (
              <>
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
                      <div className="text-xs text-[var(--color-text-secondary)]">Total (GST)</div>
                      <div className="text-lg font-bold text-[var(--color-brand-deep-green)]">
                        {formatCurrency(purchase.gst_total)}
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

                  {/* Financial Summary from purchases table */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Subtotal</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(purchase.gst_subtotal)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">Tax Amount</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(purchase.tax_amount)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-secondary)]">GST Total</div>
                      <div className="text-sm font-bold text-[var(--color-brand-deep-green)] mt-0.5">
                        {formatCurrency(purchase.gst_total)}
                      </div>
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
                          All line items recorded under this purchase invoice.
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
                          <th className="py-3 px-4">HSN Code</th>
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {!purchase.items || purchase.items.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="py-10 text-center text-[var(--color-text-muted)]">
                              No items found for this purchase.
                            </td>
                          </tr>
                        ) : (
                          purchase.items.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-[var(--color-surface-hover)] transition-colors"
                            >
                              <td className="py-3.5 px-4 font-mono text-xs text-[var(--color-text-secondary)]">
                                {item.hsn_code || '—'}
                              </td>

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

                              <td className="py-3.5 px-4 text-right font-bold text-[var(--color-brand-deep-green)]">
                                {formatCurrency(item.gst_total_price)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function OpenPurchasePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-brand-deep-green)]" />
        </div>
      }
    >
      <OpenPurchaseContent />
    </Suspense>
  );
}
