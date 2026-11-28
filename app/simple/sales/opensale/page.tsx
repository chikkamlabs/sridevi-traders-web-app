'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SimpleHeader from '@/components/simple/header';
import SimpleSidebar from '@/components/simple/sidebar';
import {
  getSimpleSaleBillById,
  updateSimpleSaleBillNGst,
  SimpleSaleBill,
  SimpleUnitPriceFactor,
} from '@/lib/simple/nsalesStore';
import { recordSimpleSaleDealerTransaction } from '@/lib/simple/ndealertrasacationsStore';
import {
  getSimpleDealerBalances,
  getSimpleDealerTransactions,
} from '@/lib/simple/ndealersFinanceStore';
import { downloadNsaleReceipt } from '@/lib/simple/downloadNsaleReceipt';
import { getSimpleUserProfile } from '@/lib/secretProfile';
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

interface EditableSaleItemState {
  id: string;
  n_gst_unit_price: string;
  n_gst_unit_price_factor: SimpleUnitPriceFactor;
  n_gst_total_price: string;
}

function formatCurrency(val: number): string {
  return `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SimpleOpenSaleContent() {
  const searchParams = useSearchParams();
  const saleId = searchParams.get('id');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [simpleName, setSimpleName] = useState('');
  const [sale, setSale] = useState<SimpleSaleBill | null>(null);
  const [dealerNGstBalance, setDealerNGstBalance] = useState<number>(0);
  const [hasSavedNGstTx, setHasSavedNGstTx] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable N-GST sale fields
  const [nGstSubtotal, setNGstSubtotal] = useState('0.00');
  const [ngstExtraCharges, setNgstExtraCharges] = useState('0.00');
  const [nGstTotal, setNGstTotal] = useState('0.00');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [editableItems, setEditableItems] = useState<Record<string, EditableSaleItemState>>({});

  useEffect(() => {
    const fetchSaleDetails = async () => {
      const profile = await getSimpleUserProfile();
      if (profile?.name) {
        setSimpleName(profile.name);
      } else if (profile?.email) {
        const prefix = profile.email.split('@')[0];
        setSimpleName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      if (!saleId) {
        setError('No sale ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await getSimpleSaleBillById(saleId);
      if (data) {
        setSale(data);
        setNGstSubtotal(Number(data.n_gst_subtotal || 0).toFixed(2));
        setNgstExtraCharges(Number(data.ngst_extra_charges || 0).toFixed(2));
        setNGstTotal(Number(data.n_gst_total || 0).toFixed(2));
        setVehicleNumber(data.vehicle_number || '');
        setTransporterName(data.transporter_name || '');

        const itemsState: Record<string, EditableSaleItemState> = {};
        for (const item of data.items || []) {
          itemsState[item.id] = {
            id: item.id,
            n_gst_unit_price: Number(item.n_gst_unit_price || 0).toFixed(2),
            n_gst_unit_price_factor: item.n_gst_unit_price_factor || 'qty',
            n_gst_total_price: Number(item.n_gst_total_price || 0).toFixed(2),
          };
        }
        setEditableItems(itemsState);

        const [balances, txs] = await Promise.all([
          getSimpleDealerBalances(data.dealer_id),
          getSimpleDealerTransactions(data.dealer_id),
        ]);
        const firmBal = balances.find((b) => b.firm_id === data.firm_id);
        setDealerNGstBalance(Number(firmBal?.n_gst_balance || 0));
        setHasSavedNGstTx(
          txs.some((t) => t.reference_id === data.id && t.tax_mode === 'n_gst')
        );
      } else {
        setError('Sale bill not found.');
      }
      setLoading(false);
    };

    fetchSaleDetails();
  }, [saleId]);

  const recalcSaleNGstTotals = (
    nextItemsMap: Record<string, EditableSaleItemState>,
    extraChargesValue: string = ngstExtraCharges
  ) => {
    const sum = Object.values(nextItemsMap).reduce(
      (acc, it) => acc + (Number(it.n_gst_total_price) || 0),
      0
    );
    const extra = Math.max(0, Number(extraChargesValue) || 0);
    setNGstSubtotal(sum.toFixed(2));
    setNGstTotal((sum + extra).toFixed(2));
  };

  const handleNGstSubtotalChange = (value: string) => {
    setNGstSubtotal(value);
    const sub = Math.max(0, Number(value) || 0);
    const extra = Math.max(0, Number(ngstExtraCharges) || 0);
    setNGstTotal((sub + extra).toFixed(2));
  };

  const handleNGstExtraChargesChange = (value: string) => {
    setNgstExtraCharges(value);
    const sub = Math.max(0, Number(nGstSubtotal) || 0);
    const extra = Math.max(0, Number(value) || 0);
    setNGstTotal((sub + extra).toFixed(2));
  };

  const handleItemUnitPriceChange = (
    itemId: string,
    quantity: number,
    baseQuantity: number,
    value: string
  ) => {
    const current = editableItems[itemId];
    const factor: SimpleUnitPriceFactor = current?.n_gst_unit_price_factor || 'qty';
    const multiplier = factor === 'base_qty' ? baseQuantity : quantity;
    const unitPrice = Math.max(0, Number(value) || 0);
    const totalPrice = (multiplier * unitPrice).toFixed(2);

    const nextMap: Record<string, EditableSaleItemState> = {
      ...editableItems,
      [itemId]: {
        id: itemId,
        n_gst_unit_price: value,
        n_gst_unit_price_factor: factor,
        n_gst_total_price: totalPrice,
      },
    };
    setEditableItems(nextMap);
    recalcSaleNGstTotals(nextMap);
  };

  const handleItemUnitFactorChange = (
    itemId: string,
    quantity: number,
    baseQuantity: number,
    factor: SimpleUnitPriceFactor
  ) => {
    const current = editableItems[itemId];
    const unitPriceStr = current?.n_gst_unit_price ?? '0.00';
    const unitPrice = Math.max(0, Number(unitPriceStr) || 0);
    const multiplier = factor === 'base_qty' ? baseQuantity : quantity;
    const totalPrice = (multiplier * unitPrice).toFixed(2);

    const nextMap: Record<string, EditableSaleItemState> = {
      ...editableItems,
      [itemId]: {
        id: itemId,
        n_gst_unit_price: unitPriceStr,
        n_gst_unit_price_factor: factor,
        n_gst_total_price: totalPrice,
      },
    };
    setEditableItems(nextMap);
    recalcSaleNGstTotals(nextMap);
  };

  const handleItemTotalPriceChange = (itemId: string, value: string) => {
    const current = editableItems[itemId] || {
      id: itemId,
      n_gst_unit_price: '0.00',
      n_gst_unit_price_factor: 'qty' as SimpleUnitPriceFactor,
      n_gst_total_price: '0.00',
    };
    const nextMap: Record<string, EditableSaleItemState> = {
      ...editableItems,
      [itemId]: {
        ...current,
        n_gst_total_price: value,
      },
    };
    setEditableItems(nextMap);
    recalcSaleNGstTotals(nextMap);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    setError(null);
    setSuccessMsg(null);

    const parsedSubtotal = Number(nGstSubtotal || 0);
    const parsedExtraCharges = Number(ngstExtraCharges || 0);
    const parsedTotal = Number(nGstTotal || 0);

    if (isNaN(parsedSubtotal) || parsedSubtotal < 0) {
      setError('N-GST Subtotal must be a valid non-negative number.');
      return;
    }

    if (isNaN(parsedExtraCharges) || parsedExtraCharges < 0) {
      setError('N-GST Extra Charges must be a valid non-negative number.');
      return;
    }

    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setError('N-GST Total must be greater than 0 to record the dealer transaction.');
      return;
    }

    const itemsPayload = (sale.items || []).map((item) => {
      const edited = editableItems[item.id];
      return {
        id: item.id,
        n_gst_unit_price: Math.max(0, Number(edited?.n_gst_unit_price || 0)),
        n_gst_unit_price_factor: edited?.n_gst_unit_price_factor || 'qty',
        n_gst_total_price: Math.max(0, Number(edited?.n_gst_total_price || 0)),
      };
    });

    setIsSaving(true);

    // Check existing firm dealer n_gst_balance before adding this bill
    const existingBalances = await getSimpleDealerBalances(sale.dealer_id);
    const existingFirmBal = existingBalances.find((b) => b.firm_id === sale.firm_id);
    const nGstOldBalance = Number(existingFirmBal?.n_gst_balance || 0);
    const nGstNewBalance = nGstOldBalance + parsedTotal;

    // 1. Update sales_bills (n_gst_subtotal, ngst_extra_charges, n_gst_total, n_gst_old_balance, n_gst_new_balance)
    //    and sales_bill_items (n_gst_unit_price, n_gst_total_price)
    const updateRes = await updateSimpleSaleBillNGst({
      saleId: sale.id,
      n_gst_subtotal: parsedSubtotal,
      ngst_extra_charges: parsedExtraCharges,
      n_gst_total: parsedTotal,
      n_gst_old_balance: nGstOldBalance,
      n_gst_new_balance: nGstNewBalance,
      vehicle_number: vehicleNumber.trim() || null,
      transporter_name: transporterName.trim() || null,
      items: itemsPayload,
    });

    if (!updateRes.success) {
      setError(updateRes.error || 'Failed to update N-GST sale bill amounts.');
      setIsSaving(false);
      return;
    }

    // 2. Insert into dealer_transactions (transaction_type = sale, payment_method = NA, amount = n_gst_total, tax_mode = n_gst)
    //    and update firm_dealer_balances.n_gst_balance = firm_dealer_balances.n_gst_balance + amount
    const txRes = await recordSimpleSaleDealerTransaction({
      firm_id: sale.firm_id,
      dealer_id: sale.dealer_id,
      sales_bill_id: sale.id,
      sale_number: sale.sale_number,
      invoice_number: sale.invoice_number,
      amount: parsedTotal,
      transaction_date: sale.date,
      notes: sale.notes,
    });

    if (txRes.error) {
      setError(txRes.error);
      setIsSaving(false);
      return;
    }

    // Refresh displayed sale bill data
    const refreshed = await getSimpleSaleBillById(sale.id);
    if (refreshed) {
      setSale(refreshed);
      setNGstSubtotal(Number(refreshed.n_gst_subtotal || 0).toFixed(2));
      setNgstExtraCharges(Number(refreshed.ngst_extra_charges || 0).toFixed(2));
      setNGstTotal(Number(refreshed.n_gst_total || 0).toFixed(2));
      setVehicleNumber(refreshed.vehicle_number || '');
      setTransporterName(refreshed.transporter_name || '');
    }

    const balances = await getSimpleDealerBalances(sale.dealer_id);
    const firmBal = balances.find((b) => b.firm_id === sale.firm_id);
    setDealerNGstBalance(Number(firmBal?.n_gst_balance || 0));
    setHasSavedNGstTx(true);

    setSuccessMsg('N-GST sale details, dealer transaction, and dealer N-GST balance saved successfully.');
    setIsSaving(false);
  };

  const handleDownloadReceipt = async () => {
    if (!sale) return;

    const billNGstTotal = Number(nGstTotal || 0);
    const useSavedBalances =
      hasSavedNGstTx ||
      Number(sale.n_gst_old_balance || 0) !== 0 ||
      Number(sale.n_gst_new_balance || 0) !== 0;

    const oldNGstBalance = useSavedBalances
      ? Number(sale.n_gst_old_balance ?? 0)
      : Number(dealerNGstBalance || 0);
    const currentNGstBalance = useSavedBalances
      ? Number(sale.n_gst_new_balance ?? oldNGstBalance + billNGstTotal)
      : Number(dealerNGstBalance || 0) + billNGstTotal;

    await downloadNsaleReceipt({
      sale_number: sale.sale_number,
      invoice_number: sale.invoice_number,
      date: sale.date,
      firm_name: sale.firm_name || 'Firm',
      dealer_name: sale.dealer_name || 'Dealer',
      dealer_phone: sale.dealer_phone || null,
      dealer_address: sale.dealer_address || null,
      dealer_city: sale.dealer_city || null,
      vehicle_number: vehicleNumber.trim() || sale.vehicle_number || null,
      transporter_name: transporterName.trim() || sale.transporter_name || null,
      n_gst_subtotal: Number(nGstSubtotal || 0),
      ngst_extra_charges: Number(ngstExtraCharges || 0),
      n_gst_total: billNGstTotal,
      old_n_gst_balance: oldNGstBalance,
      current_n_gst_balance: currentNGstBalance,
      notes: sale.notes,
      items: (sale.items || []).map((item) => {
        const edited = editableItems[item.id];
        return {
          product_name: item.product_name || item.product_id,
          product_code: item.product_code || '',
          hsn_code: item.hsn_code || '',
          variant_name: item.variant_name || item.product_variant_id,
          variant_code: item.variant_code || '',
          quantity: item.quantity,
          sale_unit: item.sale_unit || null,
          conversion_factor: item.conversion_factor,
          base_quantity: item.base_quantity,
          base_unit_name: item.base_unit_name || '',
          n_gst_unit_price: Number(edited?.n_gst_unit_price ?? item.n_gst_unit_price ?? 0),
          n_gst_total_price: Number(edited?.n_gst_total_price ?? item.n_gst_total_price ?? 0),
        };
      }),
    });
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
            {/* Back link & Download */}
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/simple/sales"
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
                  href="/simple/sales"
                  className="btn btn-outline btn-sm mt-4 inline-flex"
                >
                  Return to Sales
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                {/* Sales Bill Details Card */}
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

                  {/* Financial Summary from sales_bills table (N-GST fields editable) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Subtotal</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.gst_subtotal)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-brand-white)] border border-[var(--color-brand-soft-green)]">
                      <label htmlFor="sale-n-gst-subtotal" className="text-[11px] font-semibold text-[var(--color-brand-deep-green)] block mb-1">
                        N-GST Subtotal
                      </label>
                      <input
                        id="sale-n-gst-subtotal"
                        type="number"
                        step="0.01"
                        min="0"
                        value={nGstSubtotal}
                        onChange={(e) => handleNGstSubtotalChange(e.target.value)}
                        className="input-field py-1 px-2 text-sm font-semibold"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-brand-white)] border border-[var(--color-brand-soft-green)]">
                      <label htmlFor="sale-ngst-extra-charges" className="text-[11px] font-semibold text-[var(--color-brand-deep-green)] block mb-1">
                        N-GST Extra Charges
                      </label>
                      <input
                        id="sale-ngst-extra-charges"
                        type="number"
                        step="0.01"
                        min="0"
                        value={ngstExtraCharges}
                        onChange={(e) => handleNGstExtraChargesChange(e.target.value)}
                        className="input-field py-1 px-2 text-sm font-semibold"
                        disabled={isSaving}
                      />
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
                      <div className="text-[11px] text-[var(--color-text-muted)]">GST Total</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.gst_total)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-brand-deep-green)]">
                      <label htmlFor="sale-n-gst-total" className="text-[11px] font-semibold text-[var(--color-brand-deep-green)] block mb-1">
                        N-GST Total
                      </label>
                      <input
                        id="sale-n-gst-total"
                        type="number"
                        step="0.01"
                        min="0"
                        value={nGstTotal}
                        onChange={(e) => setNGstTotal(e.target.value)}
                        className="input-field py-1 px-2 text-sm font-bold text-[var(--color-brand-deep-green)]"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">N-GST Old Balance</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.n_gst_old_balance || 0)}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border-subtle)]">
                      <div className="text-[11px] text-[var(--color-text-muted)]">N-GST New Balance</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                        {formatCurrency(sale.n_gst_new_balance || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Number & Transporter Name (Editable) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--color-border-subtle)]">
                    <div className="form-group mb-0">
                      <label htmlFor="sale-vehicle-number" className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                        Vehicle Number
                      </label>
                      <input
                        id="sale-vehicle-number"
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        placeholder="Enter vehicle number..."
                        className="input-field py-2 px-3 text-sm"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="form-group mb-0">
                      <label htmlFor="sale-transporter-name" className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                        Transporter Name
                      </label>
                      <input
                        id="sale-transporter-name"
                        type="text"
                        value={transporterName}
                        onChange={(e) => setTransporterName(e.target.value)}
                        placeholder="Enter transporter name..."
                        className="input-field py-2 px-3 text-sm"
                        disabled={isSaving}
                      />
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
                          Edit N-GST Unit Price and N-GST Total Price for each item.
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
                          <th className="py-3 px-4 text-right">Disc. Rate</th>
                          <th className="py-3 px-4 text-right">Disc. Amt</th>
                          <th className="py-3 px-4 text-right">Tax Rate</th>
                          <th className="py-3 px-4 text-right">Tax Amt</th>
                          <th className="py-3 px-4 text-right">Total Price (GST)</th>
                          <th className="py-3 px-4 text-right">N-GST Unit Price</th>
                          <th className="py-3 px-4">Unit Factor</th>
                          <th className="py-3 px-4 text-right">N-GST Total Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {!sale.items || sale.items.length === 0 ? (
                          <tr>
                            <td colSpan={16} className="py-10 text-center text-[var(--color-text-muted)]">
                              No items found for this sale bill.
                            </td>
                          </tr>
                        ) : (
                          sale.items.map((item) => {
                            const editState = editableItems[item.id] || {
                              id: item.id,
                              n_gst_unit_price: Number(item.n_gst_unit_price || 0).toFixed(2),
                              n_gst_unit_price_factor: item.n_gst_unit_price_factor || 'qty',
                              n_gst_total_price: Number(item.n_gst_total_price || 0).toFixed(2),
                            };

                            return (
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
                                      handleItemUnitPriceChange(
                                        item.id,
                                        item.quantity,
                                        item.base_quantity,
                                        e.target.value
                                      )
                                    }
                                    className="input-field py-1.5 px-2.5 text-right text-sm min-w-[110px]"
                                    disabled={isSaving}
                                  />
                                </td>

                                <td className="py-3.5 px-4 min-w-[115px]">
                                  <select
                                    aria-label={`Unit Factor for ${item.product_name || 'item'}`}
                                    value={editState.n_gst_unit_price_factor}
                                    onChange={(e) =>
                                      handleItemUnitFactorChange(
                                        item.id,
                                        item.quantity,
                                        item.base_quantity,
                                        e.target.value as SimpleUnitPriceFactor
                                      )
                                    }
                                    className="input-field py-1.5 px-2 text-sm min-w-[100px]"
                                    disabled={isSaving}
                                  >
                                    <option value="qty">qty</option>
                                    <option value="base_qty">base_qty</option>
                                  </select>
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

export default function SimpleOpenSalePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-brand-deep-green)]" />
        </div>
      }
    >
      <SimpleOpenSaleContent />
    </Suspense>
  );
}
