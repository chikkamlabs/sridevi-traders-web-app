'use client';

import { useState } from 'react';
import { X, Edit3, Lock, AlertCircle, CheckCircle2, Calendar, Hash, IndianRupee } from 'lucide-react';
import { updateSupplier, Supplier } from '@/lib/suppliersStore';

interface OpenSupplierProps {
  supplier: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
  onSupplierUpdated: (updatedSupplier: Supplier) => void;
}

function OpenSupplierForm({
  supplier,
  onClose,
  onSupplierUpdated,
}: {
  supplier: Supplier;
  onClose: () => void;
  onSupplierUpdated: (s: Supplier) => void;
}) {
  const [name, setName] = useState(supplier.name || '');
  const [supplierCode, setSupplierCode] = useState(supplier.supplier_code || '');
  const [phone, setPhone] = useState(supplier.phone || '');
  const [email, setEmail] = useState(supplier.email || '');
  const [gstNumber, setGstNumber] = useState(supplier.gst_number || '');
  const [city, setCity] = useState(supplier.city || '');
  const [address, setAddress] = useState(supplier.address || '');
  const [notes, setNotes] = useState(supplier.notes || '');
  const [status, setStatus] = useState(supplier.status ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Supplier name cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: err } = await updateSupplier(supplier.id, {
        name: cleanName,
        supplier_code: supplierCode.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gst_number: gstNumber.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      });

      if (err || !data) {
        setError(err || 'Failed to update supplier.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onSupplierUpdated({ ...supplier, ...data });

      setTimeout(() => {
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating supplier details.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-xl bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in my-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-supplier-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
          <h2 id="open-supplier-title" className="text-lg font-bold text-[var(--color-text-primary)]">
            Supplier Details & Editor
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
      <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger)]" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--color-brand-deep-green)]" />
            <span>Supplier details updated successfully!</span>
          </div>
        )}

        {/* Readonly Metadata Bar */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)] text-xs">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Hash className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span className="truncate">ID: {supplier.id}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span>
              {supplier.created_at ? new Date(supplier.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>

        {/* View-Only Balances Display (Instructed: Display with multiple firm-balances with firm name. Don't allow to change the balances just view them) */}
        <div className="p-4 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-[var(--color-brand-deep-green)]">
              <IndianRupee className="w-4 h-4" />
              <span>Firm Outstanding Balances (Payable)</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] bg-[var(--color-brand-white)] px-2.5 py-0.5 rounded border border-[var(--color-border-subtle)] font-medium">
              <Lock className="w-3 h-3" />
              View-Only
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-0.5 pb-2 border-b border-[var(--color-border-subtle)]">
            <span className="text-xs text-[var(--color-text-secondary)] font-semibold">
              Total Outstanding Balance (All Firms):
            </span>
            <span className="font-mono text-base font-bold text-[var(--color-brand-deep-green)]">
              ₹{(supplier.total_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* List of multiple firm-balances with firm name */}
          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-[var(--color-text-secondary)] block">
              Firm-Wise GST Balances:
            </span>
            {supplier.balances && supplier.balances.length > 0 ? (
              <div className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] p-2">
                {supplier.balances.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 px-2 text-[var(--color-text-primary)]">
                    <span className="font-medium text-xs truncate max-w-[260px]">
                      {b.firm_name || 'Firm'}
                    </span>
                    <span className="font-mono font-semibold text-xs text-[var(--color-brand-deep-green)]">
                      ₹{Number(b.gst_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)]">
                No individual firm balances recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="form-group mb-0">
          <label htmlFor="edit-supplier-name" className="form-label">
            Supplier / Company Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-supplier-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-sm"
            disabled={loading}
          />
        </div>

        {/* Code */}
        <div className="form-group mb-0">
          <label htmlFor="edit-supplier-code" className="form-label">
            Supplier Code
          </label>
          <input
            id="edit-supplier-code"
            type="text"
            value={supplierCode}
            onChange={(e) => setSupplierCode(e.target.value)}
            className="input-field font-mono text-sm"
            disabled={loading}
          />
        </div>

        {/* Phone & City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-group mb-0">
            <label htmlFor="edit-supplier-phone" className="form-label">
              Mobile / Phone
            </label>
            <input
              id="edit-supplier-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field text-sm"
              disabled={loading}
            />
          </div>

          <div className="form-group mb-0">
            <label htmlFor="edit-supplier-city" className="form-label">
              City / Town
            </label>
            <input
              id="edit-supplier-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input-field text-sm"
              disabled={loading}
            />
          </div>
        </div>

        {/* GST & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-group mb-0">
            <label htmlFor="edit-supplier-gst" className="form-label">
              GST Number
            </label>
            <input
              id="edit-supplier-gst"
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              className="input-field text-sm font-mono uppercase"
              disabled={loading}
            />
          </div>

          <div className="form-group mb-0">
            <label htmlFor="edit-supplier-email" className="form-label">
              Email Address
            </label>
            <input
              id="edit-supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-sm"
              disabled={loading}
            />
          </div>
        </div>

        {/* Address */}
        <div className="form-group mb-0">
          <label htmlFor="edit-supplier-address" className="form-label">
            Address
          </label>
          <textarea
            id="edit-supplier-address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-field text-sm resize-none"
            disabled={loading}
          />
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Supplier Status</span>
            <p className="small-text">Mark active or inactive.</p>
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
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OpenSupplierModal({
  supplier,
  isOpen,
  onClose,
  onSupplierUpdated,
}: OpenSupplierProps) {
  if (!isOpen || !supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <OpenSupplierForm
        key={supplier.id}
        supplier={supplier}
        onClose={onClose}
        onSupplierUpdated={onSupplierUpdated}
      />
    </div>
  );
}
