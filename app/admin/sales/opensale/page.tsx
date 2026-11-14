'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getSaleBillById, SaleBill } from '@/lib/salesStore';
import { downloadSaleReceipt } from '@/lib/downloadSaleReceipt';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Calendar,
  Building2,
  Users,
  Package,
  FileText,
  Download,
} from 'lucide-react';

function formatCurrency(val: number): string {
  return `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function OpenSaleContent() {
  const searchParams = useSearchParams();
  const saleId = searchParams.get('id');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [sale, setSale] = useState<SaleBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSaleDetails = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      if (!saleId) {
        setError('No sale ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await getSaleBillById(saleId);
      if (data) {
        setSale(data);
      } else {
        setError('Sale bill not found.');
      }
      setLoading(false);
    };

    fetchSaleDetails();
  }, [saleId]);

  const handleDownloadReceipt = () => {
    if (!sale) return;

    downloadSaleReceipt({
      sale_number: sale.sale_number,
      invoice_number: sale.invoice_number,
      date: sale.date,
      firm_name: sale.firm_name || 'Firm',
      dealer_name: sale.dealer_name || 'Dealer',
      dealer_phone: sale.dealer_phone || null,
      gst_subtotal: sale.gst_subtotal,
      tax_amount: sale.tax_amount,
      gst_total: sale.gst_total,
      notes: sale.notes,
      items: (sale.items || []).map((item) => ({
        product_name: item.product_name || item.product_id,
        product_code: item.product_code || '',
        variant_name: item.variant_name || item.product_variant_id,
        variant_code: item.variant_code || '',
        quantity: item.quantity,
        conversion_factor: item.conversion_factor,
        base_quantity: item.base_quantity,
        base_unit_name: item.base_unit_name || '',
        gst_unit_price: item.gst_unit_price,
        discount_rate: item.discount_rate,
        discount_amount: item.discount_amount,
        tax_rate: item.tax_rate,
        tax_amount: item.tax_amount,
        gst_total_price: item.gst_total_price,
      })),
    });
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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Back link & Download */}
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/admin/sales/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sales</span>
              </Link>

              {sale && (
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  className="btn btn-primary btn-sm inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-12 text-center text-[var(--color-text-muted)]">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[var(--color-brand-deep-green)]" />
                <span>Loading sale details...</span>
              </div>
            ) : !sale ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-danger-text)]">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[var(--color-danger)]" />
                <p className="font-semibold">{error || 'Sale bill could not be found.'}</p>
                <Link
                  href="/admin/sales/dashboard"
                  className="btn btn-outline btn-sm mt-4 inline-flex"
                >
                  Return to Sales
                </Link>
              </div>
            ) : (
              <>
                {/* Sales Bill Table Details Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                            Sale Bill Details
                          </h1>
                          <span className="px-2.5 py-0.5 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-xs font-semibold text-[var(--color-brand-deep-green)]">
                            {sale.sale_number}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                          Invoice Number:{' '}
                          <strong className="text-[var(--color-text-primary)]">
                            {sale.invoice_number}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="px-4 py-2.5 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] text-right">
                      <div className="text-xs text-[var(--color-text-secondary)]">Total (GST)</div>
                      <div className="text-lg font-bold text-[var(--color-brand-deep-green)]">
                        {formatCurrency(sale.gst_total)}
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
                        {sale.firm_name || sale.firm_id}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Dealer</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {sale.dealer_name || sale.dealer_id}
                      </div>
                      {sale.dealer_phone && (
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {sale.dealer_phone}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Sale / Invoice No.</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {sale.sale_number}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        Inv: {sale.invoice_number}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Sale Date</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {sale.date}
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary from sales_bills table */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Subtotal</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.gst_subtotal)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">N-GST Subtotal</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.n_gst_subtotal)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">Tax Rate</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {sale.tax_rate}%
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">Tax Amount</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.tax_amount)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-secondary)]">GST Total</div>
                      <div className="text-sm font-bold text-[var(--color-brand-deep-green)] mt-0.5">
                        {formatCurrency(sale.gst_total)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">N-GST Total</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.n_gst_total)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-brand-light-green)] border border-[var(--color-brand-soft-green)]">
                      <div className="text-[11px] text-[var(--color-brand-deep-green)]">Grand Total</div>
                      <div className="text-sm font-bold text-[var(--color-brand-deep-green)] mt-0.5">
                        {formatCurrency(sale.grand_total)}
                      </div>
                    </div>
                  </div>

                  {/* Notes & Timestamps */}
                  <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
                    <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Notes</div>
                    <p className="text-sm text-[var(--color-text-primary)] bg-[var(--color-background)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
                      {sale.notes || 'No notes recorded for this sale.'}
                    </p>
                  </div>

                  {sale.created_at && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Created on {new Date(sale.created_at).toLocaleString()}
                        {sale.updated_at &&
                          ` • Last updated ${new Date(sale.updated_at).toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sales Bill Items Table Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                          Sales Bill Items
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          All line items recorded under this sales invoice.
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-primary">
                      {sale.items?.length || 0} Items
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
                          <th className="py-3 px-4 text-right">Disc. Rate</th>
                          <th className="py-3 px-4 text-right">Disc. Amt</th>
                          <th className="py-3 px-4 text-right">Tax Rate</th>
                          <th className="py-3 px-4 text-right">Tax Amt</th>
                          <th className="py-3 px-4 text-right">Total Price (GST)</th>
                          <th className="py-3 px-4 text-right">N-GST Unit</th>
                          <th className="py-3 px-4 text-right">N-GST Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {!sale.items || sale.items.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="py-10 text-center text-[var(--color-text-muted)]">
                              No items found for this sale bill.
                            </td>
                          </tr>
                        ) : (
                          sale.items.map((item) => (
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

                              <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                {formatCurrency(item.n_gst_unit_price)}
                              </td>

                              <td className="py-3.5 px-4 text-right text-[var(--color-text-secondary)]">
                                {formatCurrency(item.n_gst_total_price)}
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

export default function OpenSalePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-brand-deep-green)]" />
        </div>
      }
    >
      <OpenSaleContent />
    </Suspense>
  );
}
