'use client';

import { useState } from 'react';
import { X, Edit3, AlertCircle, CheckCircle2, Calendar, Hash } from 'lucide-react';
import { updateUnit, Unit } from '@/lib/unitsStore';

interface OpenUnitProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onUnitUpdated: (updatedUnit: Unit) => void;
}

function OpenUnitForm({
  unit,
  onClose,
  onUnitUpdated,
}: {
  unit: Unit;
  onClose: () => void;
  onUnitUpdated: (updatedUnit: Unit) => void;
}) {
  const [name, setName] = useState(unit.name || '');
  const [useName, setUseName] = useState(unit.use_name || '');
  const [status, setStatus] = useState(unit.status ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanUseName = useName.trim();

    if (!cleanName || !cleanUseName) {
      setError('Unit name and usage name cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: err } = await updateUnit(unit.id, {
        name: cleanName,
        use_name: cleanUseName,
        status,
      });

      if (err || !data) {
        setError(err || 'Failed to update unit.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onUnitUpdated(data);

      setTimeout(() => {
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating unit details.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-lg bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-unit-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
          <h2 id="open-unit-title" className="text-lg font-bold text-[var(--color-text-primary)]">
            Unit Details & Editor
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
      <form onSubmit={handleSave} className="p-6 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger)]" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--color-brand-deep-green)]" />
            <span>Unit details updated successfully!</span>
          </div>
        )}

        {/* Readonly Metadata Bar */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)] text-xs">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Hash className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span className="truncate">ID: {unit.id}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span>
              {unit.created_at ? new Date(unit.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>

        {/* Unit Name */}
        <div className="form-group mb-0">
          <label htmlFor="edit-unit-name" className="form-label">
            Unit Name / Symbol <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-unit-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. KG, Box"
            className="input-field"
            disabled={loading}
          />
        </div>

        {/* Unit Use Name */}
        <div className="form-group mb-0">
          <label htmlFor="edit-unit-use-name" className="form-label">
            Full Usage Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-unit-use-name"
            type="text"
            required
            value={useName}
            onChange={(e) => setUseName(e.target.value)}
            placeholder="e.g. Kilogram, Carton Box"
            className="input-field"
            disabled={loading}
          />
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Unit Status</span>
            <p className="small-text">Mark unit active or inactive across the system.</p>
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
            className="btn btn-primary min-w-[100px]"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OpenUnitModal({ unit, isOpen, onClose, onUnitUpdated }: OpenUnitProps) {
  if (!isOpen || !unit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in">
      <OpenUnitForm
        key={unit.id}
        unit={unit}
        onClose={onClose}
        onUnitUpdated={onUnitUpdated}
      />
    </div>
  );
}
