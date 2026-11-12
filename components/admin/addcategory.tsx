'use client';

import { useState } from 'react';
import { X, Layers, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { addCategory, generateCategoryCode, Category } from '@/lib/categoriesStore';

interface AddCategoryProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryAdded: (newCat: Category) => void;
}

export default function AddCategoryModal({
  isOpen,
  onClose,
  onCategoryAdded,
}: AddCategoryProps) {
  const [name, setName] = useState('');
  const [categoryCode, setCategoryCode] = useState(() => generateCategoryCode());
  const [status, setStatus] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleRegenerateCode = () => {
    setCategoryCode(generateCategoryCode());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanCode = categoryCode.trim() || generateCategoryCode();

    if (!cleanName) {
      setError('Please provide a category name.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: err } = await addCategory({
        name: cleanName,
        category_code: cleanCode,
        status,
      });

      if (err || !data) {
        setError(err || 'Failed to save category.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onCategoryAdded(data);

      setTimeout(() => {
        setName('');
        setCategoryCode(generateCategoryCode());
        setStatus(true);
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error creating category.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-md bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-category-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
            <h2 id="add-category-title" className="text-lg font-bold text-[var(--color-text-primary)]">
              Add New Category
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger)]" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--color-brand-deep-green)]" />
              <span>Category added successfully!</span>
            </div>
          )}

          {/* Category Code (cat_XXXX format) */}
          <div className="form-group mb-0">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="category-code" className="form-label mb-0">
                Category Code <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleRegenerateCode}
                className="text-xs text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </div>
            <input
              id="category-code"
              type="text"
              required
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              placeholder="e.g. cat_1234"
              className="input-field font-mono text-sm font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
              disabled={loading}
            />
            <span className="small-text mt-1">Unique code format: <code>cat_(4 random numbers)</code></span>
          </div>

          {/* Category Name */}
          <div className="form-group mb-0">
            <label htmlFor="category-name" className="form-label">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              id="category-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grains & Rice, Spices, Pulses"
              className="input-field text-sm"
              disabled={loading}
              autoFocus
            />
            <span className="small-text mt-1">Classification title used in product catalogs and reports.</span>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Category Status</span>
              <p className="small-text">Enable or disable this category across products.</p>
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
              {loading ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
