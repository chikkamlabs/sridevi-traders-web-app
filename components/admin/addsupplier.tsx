'use client';

import { useState, useEffect } from 'react';
import { X, Truck, AlertCircle, CheckCircle2, Search, IndianRupee, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { addSupplier, generateSupplierCode, Supplier } from '@/lib/suppliersStore';
import { getFirms, Firm } from '@/lib/firmsStore';

interface AddSupplierProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierAdded: (newSupplier: Supplier) => void;
}

export default function AddSupplierModal({ isOpen, onClose, onSupplierAdded }: AddSupplierProps) {
  const [name, setName] = useState('');
  const [supplierCode, setSupplierCode] = useState(() => generateSupplierCode());
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(true);

  // Opening Balances (Multiple Firms)
  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmBalances, setFirmBalances] = useState<Array<{ firm_id: string; balance: string | number }>>([
    { firm_id: '', balance: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const loadFirms = async () => {
        const data = await getFirms();
        setFirms(data);
        if (data.length > 0) {
          setFirmBalances((prev) => {
            if (prev.length === 1 && !prev[0].firm_id) {
              return [{ firm_id: data[0].id, balance: '' }];
            }
            return prev;
          });
        }
      };
      loadFirms();
    }
  }, [isOpen]);

  const handleAddFirmBalanceRow = () => {
    const unusedFirm = firms.find((f) => !firmBalances.some((fb) => fb.firm_id === f.id));
    const nextFirmId = unusedFirm ? unusedFirm.id : (firms[0]?.id || '');
    setFirmBalances((prev) => [...prev, { firm_id: nextFirmId, balance: '' }]);
  };

  const handleRemoveFirmBalanceRow = (index: number) => {
    setFirmBalances((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFirmChange = (index: number, newFirmId: string) => {
    setFirmBalances((prev) =>
      prev.map((item, i) => (i === index ? { ...item, firm_id: newFirmId } : item))
    );
  };

  const handleBalanceChange = (index: number, val: string) => {
    setFirmBalances((prev) =>
      prev.map((item, i) => (i === index ? { ...item, balance: val } : item))
    );
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Supplier name is required.');
      return;
    }

    const formattedBalances = firmBalances
      .filter((fb) => fb.firm_id && fb.balance !== '' && !isNaN(Number(fb.balance)))
      .map((fb) => ({
        firm_id: fb.firm_id,
        balance: Math.max(0, Number(fb.balance)),
      }));

    setLoading(true);

    try {
      const { data, error: err } = await addSupplier({
        name: cleanName,
        supplier_code: supplierCode.trim() || generateSupplierCode(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gst_number: gstNumber.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
        opening_balances: formattedBalances,
      });

      if (err || !data) {
        setError(err || 'Failed to save supplier.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onSupplierAdded(data);

      setTimeout(() => {
        setName('');
        setSupplierCode(generateSupplierCode());
        setPhone('');
        setEmail('');
        setGstNumber('');
        setCity('');
        setAddress('');
        setNotes('');
        setStatus(true);
        setFirmBalances([{ firm_id: firms[0]?.id || '', balance: '' }]);
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error creating supplier profile.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-xl bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-supplier-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
            <h2 id="add-supplier-title" className="text-lg font-bold text-[var(--color-text-primary)]">
              Add New Supplier
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
              <span>Supplier registered successfully!</span>
            </div>
          )}

          {/* Supplier Name */}
          <div className="form-group mb-0">
            <label htmlFor="supplier-name" className="form-label">
              Supplier / Company Name <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kisan Agro Commodities Pvt Ltd"
              className="input-field text-sm"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Supplier Code */}
          <div className="form-group mb-0">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="supplier-code" className="form-label mb-0">
                Supplier Code <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setSupplierCode(generateSupplierCode())}
                className="text-xs text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </div>
            <input
              id="supplier-code"
              type="text"
              required
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              placeholder="e.g. sup_1234"
              className="input-field font-mono text-sm font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
              disabled={loading}
            />
          </div>

          {/* Mobile Phone & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label htmlFor="supplier-phone" className="form-label">
                Mobile / Phone
              </label>
              <input
                id="supplier-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 98480 67890"
                className="input-field text-sm"
                disabled={loading}
              />
            </div>

            <div className="form-group mb-0">
              <label htmlFor="supplier-city" className="form-label">
                City / Town
              </label>
              <input
                id="supplier-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Hyderabad, Nagpur"
                className="input-field text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* GST & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label htmlFor="supplier-gst" className="form-label">
                GST Number
              </label>
              <input
                id="supplier-gst"
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 36AAAAA0000A1Z5"
                className="input-field text-sm font-mono uppercase"
                disabled={loading}
              />
            </div>

            <div className="form-group mb-0">
              <label htmlFor="supplier-email" className="form-label">
                Email Address
              </label>
              <input
                id="supplier-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supply@kisanagro.com"
                className="input-field text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* Address */}
          <div className="form-group mb-0">
            <label htmlFor="supplier-address" className="form-label">
              Office / Warehouse Address
            </label>
            <textarea
              id="supplier-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Warehouse No, Industrial Area"
              className="input-field text-sm resize-none"
              disabled={loading}
            />
          </div>

          {/* Multiple Firm Balances Section (Instructed: Allow to Add multiple firm-balances) */}
          <div className="p-4 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-[var(--color-brand-deep-green)]" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Firm Opening Balances (Payable)
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddFirmBalanceRow}
                className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                disabled={loading || firms.length === 0}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Firm Balance</span>
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Specify initial payable balance for one or more business firms (recorded into <code>firm_supplier_balances.gst_balance</code>).
            </p>

            <div className="space-y-2.5">
              {firmBalances.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-[var(--color-brand-white)] p-2.5 rounded-lg border border-[var(--color-border)]"
                >
                  {/* Select Firm */}
                  <div className="flex-1">
                    <label className="sr-only">Select Firm</label>
                    <select
                      value={row.firm_id}
                      onChange={(e) => handleFirmChange(idx, e.target.value)}
                      className="select-field text-xs py-1.5"
                      disabled={loading}
                    >
                      <option value="" disabled>Select Firm</option>
                      {firms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} {f.legal_name ? `(${f.legal_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Balance Amount */}
                  <div className="w-36 sm:w-44">
                    <label className="sr-only">Balance Amount</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.balance}
                        onChange={(e) => handleBalanceChange(idx, e.target.value)}
                        placeholder="0.00"
                        className="input-field pl-6 text-xs py-1.5"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Remove row */}
                  {firmBalances.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFirmBalanceRow(idx)}
                      className="p-1.5 rounded-md text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors cursor-pointer shrink-0"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {firms.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
                  No firms registered yet. Balances can also be recorded later.
                </p>
              )}
            </div>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Supplier Status</span>
              <p className="small-text">Active suppliers can be selected in purchase bills.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={status}
                onChange={(e) => setStatus(e.target.checked)}
                className="sr-only peer"
                disabled={loading}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-deep-green)]"></div>
            </label>
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
              {loading ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
