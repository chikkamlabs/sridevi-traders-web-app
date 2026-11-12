'use client';

import { useState } from 'react';
import { X, Edit3, Lock, AlertCircle, CheckCircle2, Calendar, Hash, IndianRupee } from 'lucide-react';
import { updateDealer, Dealer } from '@/lib/dealersStore';

interface OpenDealerProps {
  dealer: Dealer | null;
  isOpen: boolean;
  onClose: () => void;
  onDealerUpdated: (updatedDealer: Dealer) => void;
}

function OpenDealerForm({
  dealer,
  onClose,
  onDealerUpdated,
}: {
  dealer: Dealer;
  onClose: () => void;
  onDealerUpdated: (d: Dealer) => void;
}) {
  const [name, setName] = useState(dealer.name || '');
  const [phone, setPhone] = useState(dealer.phone || '');
  const [email, setEmail] = useState(dealer.email || '');
  const [gstNumber, setGstNumber] = useState(dealer.gst_number || '');
  const [city, setCity] = useState(dealer.city || '');
  const [address, setAddress] = useState(dealer.address || '');
  const [notes, setNotes] = useState(dealer.notes || '');
  const [status, setStatus] = useState(dealer.status ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Dealer name cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: err } = await updateDealer(dealer.id, {
        name: cleanName,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gst_number: gstNumber.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      });

      if (err || !data) {
        setError(err || 'Failed to update dealer.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onDealerUpdated({ ...dealer, ...data });

      setTimeout(() => {
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating dealer details.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-xl bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in my-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-dealer-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
          <h2 id="open-dealer-title" className="text-lg font-bold text-[var(--color-text-primary)]">
            Dealer Details & Editor
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
            <span>Dealer details updated successfully!</span>
          </div>
        )}

        {/* Readonly Metadata Bar */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)] text-xs">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Hash className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span className="truncate">ID: {dealer.id}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span>
              {dealer.created_at ? new Date(dealer.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>

        {/* View-Only Balances Display (Instructed: Display with multiple firm-balances with firm name. Don't allow to change the balances just view them) */}
        <div className="p-4 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-[var(--color-brand-deep-green)]">
              <IndianRupee className="w-4 h-4" />
              <span>Firm Outstanding Balances</span>
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
              ₹{(dealer.total_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* List of multiple firm-balances with firm name */}
          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-[var(--color-text-secondary)] block">
              Firm-Wise GST Balances:
            </span>
            {dealer.balances && dealer.balances.length > 0 ? (
              <div className="divide-y divide-[var(--color-border-subtle)] bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] p-2">
                {dealer.balances.map((b, idx) => (
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
          <label htmlFor="edit-dealer-name" className="form-label">
            Dealer / Store Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-dealer-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-sm"
            disabled={loading}
          />
        </div>

        {/* Phone & City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-group mb-0">
            <label htmlFor="edit-dealer-phone" className="form-label">
              Mobile / Phone
            </label>
            <input
              id="edit-dealer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field text-sm"
              disabled={loading}
            />
          </div>

          <div className="form-group mb-0">
            <label htmlFor="edit-dealer-city" className="form-label">
              City / Town
            </label>
            <input
              id="edit-dealer-city"
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
            <label htmlFor="edit-dealer-gst" className="form-label">
              GST Number
            </label>
            <input
              id="edit-dealer-gst"
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              className="input-field text-sm font-mono uppercase"
              disabled={loading}
            />
          </div>

          <div className="form-group mb-0">
            <label htmlFor="edit-dealer-email" className="form-label">
              Email Address
            </label>
            <input
              id="edit-dealer-email"
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
          <label htmlFor="edit-dealer-address" className="form-label">
            Address
          </label>
          <textarea
            id="edit-dealer-address"
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
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Dealer Status</span>
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

export default function OpenDealerModal({
  dealer,
  isOpen,
  onClose,
  onDealerUpdated,
}: OpenDealerProps) {
  if (!isOpen || !dealer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <OpenDealerForm
        key={dealer.id}
        dealer={dealer}
        onClose={onClose}
        onDealerUpdated={onDealerUpdated}
      />
    </div>
  );
}
