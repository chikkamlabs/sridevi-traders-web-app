'use client';

import { useState } from 'react';
import { X, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { addFirm, Firm } from '@/lib/firmsStore';

interface AddFirmProps {
  isOpen: boolean;
  onClose: () => void;
  onFirmAdded: (newFirm: Firm) => void;
}

export default function AddFirmModal({ isOpen, onClose, onFirmAdded }: AddFirmProps) {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Firm name is required.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: err } = await addFirm({
        name: cleanName,
        legal_name: legalName.trim() || undefined,
        gst_number: gstNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        status,
      });

      if (err || !data) {
        setError(err || 'Failed to save firm details.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onFirmAdded(data);

      setTimeout(() => {
        setName('');
        setLegalName('');
        setGstNumber('');
        setPhone('');
        setEmail('');
        setAddress('');
        setStatus(true);
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error creating firm profile.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-lg bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-firm-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
            <h2 id="add-firm-title" className="text-lg font-bold text-[var(--color-text-primary)]">
              Add New Firm
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
              <span>Firm registered successfully!</span>
            </div>
          )}

          {/* Firm Name */}
          <div className="form-group mb-0">
            <label htmlFor="firm-name" className="form-label">
              Firm / Trade Name <span className="text-red-500">*</span>
            </label>
            <input
              id="firm-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sridevi Traders"
              className="input-field text-sm"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Legal Registered Name */}
          <div className="form-group mb-0">
            <label htmlFor="firm-legal-name" className="form-label">
              Legal Registered Name
            </label>
            <input
              id="firm-legal-name"
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Sridevi Traders Wholesale Pvt Ltd"
              className="input-field text-sm"
              disabled={loading}
            />
          </div>

          {/* GST Number & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group mb-0">
              <label htmlFor="firm-gst" className="form-label">
                GST Number
              </label>
              <input
                id="firm-gst"
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 36AAAAA0000A1Z5"
                className="input-field text-sm font-mono uppercase"
                disabled={loading}
              />
            </div>

            <div className="form-group mb-0">
              <label htmlFor="firm-phone" className="form-label">
                Phone Number
              </label>
              <input
                id="firm-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98480 12345"
                className="input-field text-sm"
                disabled={loading}
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group mb-0">
            <label htmlFor="firm-email" className="form-label">
              Email Address
            </label>
            <input
              id="firm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@sridevitraders.com"
              className="input-field text-sm"
              disabled={loading}
            />
          </div>

          {/* Address */}
          <div className="form-group mb-0">
            <label htmlFor="firm-address" className="form-label">
              Business Address
            </label>
            <textarea
              id="firm-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, State, PIN code"
              className="input-field text-sm resize-none"
              disabled={loading}
            />
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Firm Active Status</span>
              <p className="small-text">Allow invoicing and transactions under this firm.</p>
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
              {loading ? 'Saving...' : 'Save Firm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
