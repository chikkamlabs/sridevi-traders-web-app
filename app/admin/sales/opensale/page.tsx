'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getSaleBillById, updateSaleBillTransportDetails, SaleBill } from '@/lib/salesStore';
import { getDealerGstBalances } from '@/lib/dealertrasacationsStore';
import { downloadSaleReceipt } from '@/lib/downloadSaleReceipt';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Building2,
  Users,
  Package,
  FileText,
  Save,
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
  const [dealerGstBalance, setDealerGstBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');

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
        setVehicleNumber(data.vehicle_number || '');
        setTransporterName(data.transporter_name || '');
        const balances = await getDealerGstBalances(data.dealer_id);
        const firmBal = balances.find((b) => b.firm_id === data.firm_id);
        setDealerGstBalance(Number(firmBal?.gst_balance || 0));
      } else {
        setError('Sale bill not found.');
      }
      setLoading(false);
    };

    fetchSaleDetails();
  }, [saleId]);

  const handleSaveTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    setError(null);
    setSuccessMsg(null);
    setIsSaving(true);

    const res = await updateSaleBillTransportDetails({
      saleId: sale.id,
      vehicle_number: vehicleNumber.trim() || null,
      transporter_name: transporterName.trim() || null,
    });

    if (!res.success) {
      setError(res.error || 'Failed to update vehicle and transporter details.');
      setIsSaving(false);
      return;
    }

    const refreshed = await getSaleBillById(sale.id);
    if (refreshed) {
      setSale(refreshed);
      setVehicleNumber(refreshed.vehicle_number || '');
      setTransporterName(refreshed.transporter_name || '');
    }

    setSuccessMsg('Vehicle number and transporter name saved successfully.');
    setIsSaving(false);
  };

  const handleDownloadReceipt = async () => {
    if (!sale) return;

    await downloadSaleReceipt({
      sale_number: sale.sale_number,
      invoice_number: sale.invoice_number,
      date: sale.date,
      firm_name: sale.firm_name || 'Firm',
      firm_gst: sale.firm_gst || null,
      firm_phone: sale.firm_phone || null,
      firm_address: sale.firm_address || null,
      dealer_name: sale.dealer_name || 'Dealer',
      dealer_phone: sale.dealer_phone || null,
      dealer_address: sale.dealer_address || null,
      dealer_city: sale.dealer_city || null,
      dealer_gst: sale.dealer_gst || null,
      vehicle_number: vehicleNumber.trim() || null,
      transporter_name: transporterName.trim() || null,
      gst_subtotal: sale.gst_subtotal,
      tax_amount: sale.tax_amount,
      sgst_rate: Number(sale.sgst_rate || 0),
      sgst_amount: Number(sale.sgst_amount || 0),
      cgst_rate: Number(sale.cgst_rate || 0),
      cgst_amount: Number(sale.cgst_amount || 0),
      igst_rate: Number(sale.igst_rate || 0),
      igst_amount: Number(sale.igst_amount || 0),
      extra_charges: sale.extra_charges || 0,
      gst_total: sale.gst_total,
      old_gst_balance: Number(sale.gst_old_balance ?? 0),
      current_gst_balance: Number(sale.gst_new_balance ?? 0),
      notes: sale.notes,
      items: (sale.items || []).map((item) => ({
        product_name: item.product_name || item.product_id,
        product_code: item.product_code || '',
        hsn_code: item.hsn_code || '',
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
                      {sale.dealer_gst && (
                        <div className="text-xs text-[var(--color-text-secondary)]">
                          GST: {sale.dealer_gst}
                        </div>
                      )}
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Subtotal</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.gst_subtotal)}
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

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        SGST ({Number(sale.sgst_rate || 0)}%)
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.sgst_amount || 0)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        CGST ({Number(sale.cgst_rate || 0)}%)
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.cgst_amount || 0)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        IGST ({Number(sale.igst_rate || 0)}%)
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.igst_amount || 0)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">Extra Charges</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.extra_charges || 0)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Old Balance</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.gst_old_balance || 0)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST New Balance</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.gst_new_balance || 0)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-secondary)]">GST Total</div>
                      <div className="text-sm font-bold text-[var(--color-brand-deep-green)] mt-0.5">
                        {formatCurrency(sale.gst_total)}
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Number & Transporter Name (Editable) */}
                  <form
                    onSubmit={handleSaveTransport}
                    className="space-y-4 pt-2 border-t border-[var(--color-border-subtle)]"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="form-group mb-0">
                        <label
                          htmlFor="admin-sale-vehicle-number"
                          className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1"
                        >
                          Vehicle Number
                        </label>
                        <input
                          id="admin-sale-vehicle-number"
                          type="text"
                          value={vehicleNumber}
                          onChange={(e) => setVehicleNumber(e.target.value)}
                          placeholder="Enter vehicle number..."
                          className="input-field py-2 px-3 text-sm"
                          disabled={isSaving}
                        />
                      </div>

                      <div className="form-group mb-0">
                        <label
                          htmlFor="admin-sale-transporter-name"
                          className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1"
                        >
                          Transporter Name
                        </label>
                        <input
                          id="admin-sale-transporter-name"
                          type="text"
                          value={transporterName}
                          onChange={(e) => setTransporterName(e.target.value)}
                          placeholder="Enter transporter name..."
                          className="input-field py-2 px-3 text-sm"
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="btn btn-primary btn-sm inline-flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                      </button>
                    </div>
                  </form>

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
                          <th className="py-3 px-4">HSN Code</th>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">Variant</th>
                          <th className="py-3 px-4 text-right">Qty</th>
                          <th className="py-3 px-4">Sale Unit</th>
                          <th className="py-3 px-4 text-right">Conv. Factor</th>
                          <th className="py-3 px-4 text-right">Base Qty</th>
                          <th className="py-3 px-4 text-right">Unit Price (GST)</th>
                          <th className="py-3 px-4">Unit Factor</th>
                          <th className="py-3 px-4 text-right">Disc. Rate</th>
                          <th className="py-3 px-4 text-right">Disc. Amt</th>
                          <th className="py-3 px-4 text-right">Tax Rate</th>
                          <th className="py-3 px-4 text-right">Tax Amt</th>
                          <th className="py-3 px-4 text-right">Total Price (GST)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {!sale.items || sale.items.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="py-10 text-center text-[var(--color-text-muted)]">
                              No items found for this sale bill.
                            </td>
                          </tr>
                        ) : (
                          sale.items.map((item) => (
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
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="text-[var(--color-text-primary)]">
                                  {item.variant_name || item.product_variant_id}
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-right font-medium text-[var(--color-text-primary)]">
                                {item.quantity}
                              </td>

                              <td className="py-3.5 px-4 text-[var(--color-text-secondary)]">
                                {item.sale_unit || '—'}
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

                              <td className="py-3.5 px-4 text-[var(--color-text-secondary)]">
                                {item.gst_unit_price_factor || 'qty'}
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
