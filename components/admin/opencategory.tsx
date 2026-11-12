'use client';

import { useState } from 'react';
import { X, Layers, Edit3, AlertCircle, CheckCircle2, Calendar, Hash } from 'lucide-react';
import { updateCategory, Category } from '@/lib/categoriesStore';

interface OpenCategoryProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onCategoryUpdated: (updatedCat: Category) => void;
}

function OpenCategoryForm({
  category,
  onClose,
  onCategoryUpdated,
}: {
  category: Category;
  onClose: () => void;
  onCategoryUpdated: (c: Category) => void;
}) {
  const [name, setName] = useState(category.name || '');
  const [categoryCode, setCategoryCode] = useState(category.category_code || '');
  const [status, setStatus] = useState(category.status ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanCode = categoryCode.trim();

    if (!cleanName || !cleanCode) {
      setError('Category name and category code cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: err } = await updateCategory(category.id, {
        name: cleanName,
        category_code: cleanCode,
        status,
      });

      if (err || !data) {
        setError(err || 'Failed to update category.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      onCategoryUpdated(data);

      setTimeout(() => {
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating category.';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-md bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="open-category-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
        <div className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-[var(--color-brand-deep-green)]" />
          <h2 id="open-category-title" className="text-lg font-bold text-[var(--color-text-primary)]">
            Category Details & Editor
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
            <span>Category updated successfully!</span>
          </div>
        )}

        {/* Readonly Metadata Bar */}
        <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)] text-xs">
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Hash className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span className="truncate">ID: {category.id}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
            <span>
              {category.created_at ? new Date(category.created_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        </div>

        {/* Category Code */}
        <div className="form-group mb-0">
          <label htmlFor="edit-cat-code" className="form-label">
            Category Code <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-cat-code"
            type="text"
            required
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            className="input-field font-mono text-sm font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
            disabled={loading}
          />
        </div>

        {/* Category Name */}
        <div className="form-group mb-0">
          <label htmlFor="edit-cat-name" className="form-label">
            Category Name <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-cat-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field text-sm"
            disabled={loading}
          />
        </div>

        {/* Status Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Category Status</span>
            <p className="small-text">Mark category active or inactive.</p>
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

export default function OpenCategoryModal({
  category,
  isOpen,
  onClose,
  onCategoryUpdated,
}: OpenCategoryProps) {
  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in">
      <OpenCategoryForm
        key={category.id}
        category={category}
        onClose={onClose}
        onCategoryUpdated={onCategoryUpdated}
      />
    </div>
  );
}
