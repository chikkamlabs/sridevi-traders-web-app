'use client';

import { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getFirms, Firm } from '@/lib/firmsStore';
import {
  addSimpleSupplierTransactionAndUpdateBalance,
  generateSimpleSupplierTxCode,
} from '@/lib/simple/nsupplierFinanceStore';
import type {
  SupplierTransactionType,
  PaymentMethod,
  TaxMode,
} from '@/lib/suppliertrasacationsStore';

interface AddSupplierTransactionModalProps {
  supplierId: string;
  supplierName: string;
  isOpen: boolean;
  onClose: () => void;
  onTransactionAdded: () => void;
}

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AddSupplierTransactionModal({
  supplierId,
  supplierName,
  isOpen,
  onClose,
  onTransactionAdded,
}: AddSupplierTransactionModalProps) {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmId, setFirmId] = useState('');
  const [transactionCode, setTransactionCode] = useState(() => generateSimpleSupplierTxCode());
  const [transactionType, setTransactionType] = useState<SupplierTransactionType>('payment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [taxMode, setTaxMode] = useState<TaxMode>('n_gst');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => getTodayDateString());
  const [referenceType, setReferenceType] = useState('manual');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadFirms = async () => {
      const data = await getFirms();
      if (!active) return;
      setFirms(data);
      if (data.length > 0) {
        setFirmId((prev) => prev || data[0].id);
      }
    };
    loadFirms();
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firmId) {
      setError('Please select a firm.');
      return;
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    if (!referenceType.trim()) {
      setError('Reference type is required.');
      return;
    }

    setLoading(true);

    const { error: saveErr } = await addSimpleSupplierTransactionAndUpdateBalance({
      firm_id: firmId,
      supplier_id: supplierId,
      transaction_code: transactionCode.trim() || generateSimpleSupplierTxCode(),
      transaction_type: transactionType,
      payment_method: paymentMethod,
      amount: parsedAmount,
      tax_mode: taxMode,
      reference_type: referenceType.trim(),
      reference_id: referenceId.trim() || null,
      notes: notes.trim() || null,
      transaction_date: transactionDate || getTodayDateString(),
    });

    if (saveErr) {
      setError(saveErr);
      setLoading(false);
      return;
    }

    setSuccess(true);
    onTransactionAdded();

    setTimeout(() => {
      setSuccess(false);
      setLoading(false);
      setAmount('');
      setNotes('');
      setReferenceId('');
      setTransactionCode(generateSimpleSupplierTxCode());
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-xl bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-supplier-tx-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
            <h2 id="add-supplier-tx-title" className="text-lg font-bold text-[var(--color-text-primary)]">
              Add Supplier Transaction
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger)]" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--color-brand-deep-green)]" />
              <span>Transaction added and supplier balance updated!</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)]">
            Supplier: <strong className="text-[var(--color-text-primary)]">{supplierName}</strong>
          </div>

          {/* Firm & Transaction Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-firm" className="form-label">
                Firm <span className="text-[var(--color-danger)]">*</span>
              </label>
              <select
                id="supplier-tx-firm"
                required
                value={firmId}
                onChange={(e) => setFirmId(e.target.value)}
                className="select-field text-sm"
                disabled={loading}
              >
                <option value="">Select Firm</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-code" className="form-label">
                Transaction Code <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="supplier-tx-code"
                type="text"
                required
                value={transactionCode}
                onChange={(e) => setTransactionCode(e.target.value)}
                className="input-field font-mono text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* Transaction Type & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-type" className="form-label">
                Transaction Type <span className="text-[var(--color-danger)]">*</span>
              </label>
              <select
                id="supplier-tx-type"
                required
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as SupplierTransactionType)}
                className="select-field text-sm"
                disabled={loading}
              >
                <option value="purchase">purchase</option>
                <option value="payment">payment</option>
                <option value="purchase_return">purchase_return</option>
                <option value="opening_balance">opening_balance</option>
                <option value="adjustment">adjustment</option>
              </select>
            </div>

            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-pay-method" className="form-label">
                Payment Method <span className="text-[var(--color-danger)]">*</span>
              </label>
              <select
                id="supplier-tx-pay-method"
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="select-field text-sm"
                disabled={loading}
              >
                <option value="cash">cash</option>
                <option value="upi">upi</option>
                <option value="cheque">cheque</option>
                <option value="card">card</option>
                <option value="neft">neft</option>
                <option value="NA">NA</option>
              </select>
            </div>
          </div>

          {/* Tax Mode & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-tax-mode" className="form-label">
                Tax Mode <span className="text-[var(--color-danger)]">*</span>
              </label>
              <select
                id="supplier-tx-tax-mode"
                required
                value={taxMode}
                onChange={(e) => setTaxMode(e.target.value as TaxMode)}
                className="select-field text-sm"
                disabled={loading}
              >
                <option value="n_gst">n_gst</option>
                <option value="gst">gst</option>
                <option value="mixed">mixed</option>
                <option value="not_applicable">not_applicable</option>
              </select>
            </div>

            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-amount" className="form-label">
                Amount <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="supplier-tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input-field text-sm font-semibold"
                disabled={loading}
              />
            </div>
          </div>

          {/* Transaction Date & Reference Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-date" className="form-label">
                Transaction Date <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="supplier-tx-date"
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="input-field text-sm"
                disabled={loading}
              />
            </div>

            <div className="form-group mb-0">
              <label htmlFor="supplier-tx-ref-type" className="form-label">
                Reference Type <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="supplier-tx-ref-type"
                type="text"
                required
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value)}
                placeholder="e.g. manual, payment, purchase"
                className="input-field text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* Reference ID (Optional) */}
          <div className="form-group mb-0">
            <label htmlFor="supplier-tx-ref-id" className="form-label">
              Reference ID (Optional UUID)
            </label>
            <input
              id="supplier-tx-ref-id"
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Optional reference UUID"
              className="input-field font-mono text-sm"
              disabled={loading}
            />
          </div>

          {/* Notes */}
          <div className="form-group mb-0">
            <label htmlFor="supplier-tx-notes" className="form-label">
              Notes
            </label>
            <textarea
              id="supplier-tx-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional transaction notes..."
              className="input-field text-sm resize-none"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary min-w-[110px]"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
