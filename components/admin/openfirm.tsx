'use client';

import { useState } from 'react';
import { X, Building2, Edit3, AlertCircle, CheckCircle2, Calendar, Hash } from 'lucide-react';
import { updateFirm, Firm } from '@/lib/firmsStore';

interface OpenFirmProps {
  firm: Firm | null;
  isOpen: boolean;
  onClose: () => void;
  onFirmUpdated: (updatedFirm: Firm) => void;
}

function OpenFirmForm({
  firm,
  onClose,
  onFirmUpdated,
}: {
  firm: Firm;
  onClose: () => void;
  onFirmUpdated: (f: Firm) => void;
}) {
  const [name, setName] = useState(firm.name || '');
  const [legalName, setLegalName] = useState(firm.legal_name || '');
  const [gstNumber, setGstNumber] = useState(firm.gst_number || '');
  const [phone, setPhone] = useState(firm.phone || '');
  const [email, setEmail] = useState(firm.email || '');
  const [address, setAddress] = useState(firm.address || '');
  const [status, setStatus] = useState(firm.status ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Firm name cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: err } = await updateFirm(firm.id, {
        name: cleanName,
        legal_name: legalName.trim() || undefined,
        gst_number: gstNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        status,
      });

      if (err || !data) {
        setError(err || 'Failed to update firm.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onFirmUpdated(data);

      setTimeout(() => {
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating firm.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-lg bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in my-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-firm-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
          <h2 id="open-firm-title" className="text-lg font-bold text-[var(--color-text-primary)]">
            Firm Details & Editor
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

      {/* Form */}
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
            <span>Firm updated successfully!</span>
          </div>
        )}

        {/* Readonly Metadata Bar */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)] text-xs">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Hash className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span className="truncate">ID: {firm.id}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span>
              {firm.created_at ? new Date(firm.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>

        {/* Name */}
        <div className="form-group mb-0">
          <label htmlFor="edit-firm-name" className="form-label">
            Firm / Trade Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-firm-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-sm"
            disabled={loading}
          />
        </div>

        {/* Legal Name */}
        <div className="form-group mb-0">
          <label htmlFor="edit-firm-legal" className="form-label">
            Legal Registered Name
          </label>
          <input
            id="edit-firm-legal"
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            className="input-field text-sm"
            disabled={loading}
          />
        </div>

        {/* GST & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-group mb-0">
            <label htmlFor="edit-firm-gst" className="form-label">
              GST Number
            </label>
            <input
              id="edit-firm-gst"
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              className="input-field text-sm font-mono uppercase"
              disabled={loading}
            />
          </div>

          <div className="form-group mb-0">
            <label htmlFor="edit-firm-phone" className="form-label">
              Phone Number
            </label>
            <input
              id="edit-firm-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field text-sm"
              disabled={loading}
            />
          </div>
        </div>

        {/* Email */}
        <div className="form-group mb-0">
          <label htmlFor="edit-firm-email" className="form-label">
            Email Address
          </label>
          <input
            id="edit-firm-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field text-sm"
            disabled={loading}
          />
        </div>

        {/* Address */}
        <div className="form-group mb-0">
          <label htmlFor="edit-firm-address" className="form-label">
            Address
          </label>
          <textarea
            id="edit-firm-address"
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
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Firm Active Status</span>
            <p className="small-text">Inactive firms are hidden from transactional entry.</p>
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

export default function OpenFirmModal({ firm, isOpen, onClose, onFirmUpdated }: OpenFirmProps) {
  if (!isOpen || !firm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <OpenFirmForm
        key={firm.id}
        firm={firm}
        onClose={onClose}
        onFirmUpdated={onFirmUpdated}
      />
    </div>
  );
}
