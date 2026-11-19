'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, AlertCircle, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { getFirms, Firm } from '@/lib/firmsStore';
import { getProducts, Product } from '@/lib/productsStore';
import { getAllProductVariants, ProductVariant } from '@/lib/productvariantsStore';
import {
  addStockMovements,
  type StockMovementType,
  type StockReferenceType,
} from '@/lib/stockmovements';

interface AddStockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMovementsAdded: () => void;
}

interface MovementRowDraft {
  firm_id: string;
  product_id: string;
  product_variant_id: string;
  movement_type: StockMovementType;
  quantity_base: string;
  reference_type: StockReferenceType;
  reference_id: string;
  notes: string;
}

function createEmptyRow(defaultFirmId = ''): MovementRowDraft {
  return {
    firm_id: defaultFirmId,
    product_id: '',
    product_variant_id: '',
    movement_type: 'in',
    quantity_base: '',
    reference_type: 'adjustment',
    reference_id: '',
    notes: '',
  };
}

export default function AddStockMovementModal({
  isOpen,
  onClose,
  onMovementsAdded,
}: AddStockMovementModalProps) {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [rows, setRows] = useState<MovementRowDraft[]>([createEmptyRow()]);

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadOptions = async () => {
      setFetchingData(true);
      const [firmsData, productsData, variantsData] = await Promise.all([
        getFirms(),
        getProducts(),
        getAllProductVariants(),
      ]);
      if (!active) return;
      setFirms(firmsData);
      setProducts(productsData);
      setVariants(variantsData);

      const defaultFirmId = firmsData[0]?.id || '';
      setRows((prev) =>
        prev.map((r) => (r.firm_id ? r : { ...r, firm_id: defaultFirmId }))
      );
      setFetchingData(false);
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  // Auto-calculate remaining_quantity sequentially for each row
  const calculatedRows = useMemo(() => {
    const runningQty = new Map<string, number>();
    return rows.map((row) => {
      const prod = productMap.get(row.product_id);
      if (!prod) {
        return { currentQty: null, remainingQty: null };
      }
      const startingQty = runningQty.has(row.product_id)
        ? runningQty.get(row.product_id)!
        : Number(prod.quantity || 0);

      const qtyBase = Number(row.quantity_base);
      if (row.quantity_base === '' || isNaN(qtyBase) || qtyBase <= 0) {
        return { currentQty: startingQty, remainingQty: startingQty };
      }

      const nextQty =
        row.movement_type === 'in'
          ? Number((startingQty + qtyBase).toFixed(3))
          : Number((startingQty - qtyBase).toFixed(3));

      runningQty.set(row.product_id, nextQty);
      return { currentQty: startingQty, remainingQty: nextQty };
    });
  }, [rows, productMap]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    const lastFirmId = rows[rows.length - 1]?.firm_id || firms[0]?.id || '';
    setRows((prev) => [...prev, createEmptyRow(lastFirmId)]);
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = <K extends keyof MovementRowDraft>(
    index: number,
    field: K,
    value: MovementRowDraft[K]
  ) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'product_id') {
          const matchingVariants = variants.filter((v) => v.product_id === value);
          return {
            ...row,
            product_id: value as string,
            product_variant_id: matchingVariants[0]?.id || '',
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (rows.length === 0) {
      setError('Please add at least one stock movement row.');
      return;
    }

    const payload = rows.map((r) => ({
      firm_id: r.firm_id,
      product_id: r.product_id,
      product_variant_id: r.product_variant_id,
      movement_type: r.movement_type,
      quantity_base: Number(r.quantity_base),
      reference_type: r.reference_type,
      reference_id: r.reference_id.trim() || null,
      notes: r.notes.trim() || null,
    }));

    setLoading(true);
    const { error: saveErr } = await addStockMovements(payload);

    if (saveErr) {
      setError(saveErr);
      setLoading(false);
      return;
    }

    setSuccess(true);
    onMovementsAdded();

    setTimeout(() => {
      setSuccess(false);
      setLoading(false);
      setRows([createEmptyRow(firms[0]?.id || '')]);
      onClose();
    }, 450);
  };

  return (
    <div className="dialog-overlay animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-4xl bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xl overflow-hidden animate-scale-in my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-stock-movement-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-stock-movement-title" className="text-lg font-bold text-[var(--color-text-primary)]">
                Add Stock Movement
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Record one or multiple stock movements and automatically update product quantities.
              </p>
            </div>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger)]" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--color-brand-deep-green)]" />
              <span>Stock movements recorded and product quantities updated!</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Movement Entries ({rows.length})
            </span>
            <button
              type="button"
              onClick={handleAddRow}
              disabled={loading || fetchingData}
              className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>

          <div className="space-y-4">
            {rows.map((row, idx) => {
              const productVariants = variants.filter(
                (v) => v.product_id === row.product_id
              );
              const calc = calculatedRows[idx];
              const selectedProd = productMap.get(row.product_id);

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
                    <span className="text-xs font-bold text-[var(--color-brand-deep-green)]">
                      Row #{idx + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      {selectedProd && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          Current Stock:{' '}
                          <strong className="font-mono text-[var(--color-text-primary)]">
                            {calc.currentQty}
                          </strong>
                        </span>
                      )}
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={loading}
                          className="p-1 rounded-md text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Firm, Product, Product Variant */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="form-group mb-0">
                      <label className="form-label text-xs">
                        Firm <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <select
                        required
                        value={row.firm_id}
                        onChange={(e) => handleRowChange(idx, 'firm_id', e.target.value)}
                        className="select-field text-xs py-2"
                        disabled={loading || fetchingData}
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
                      <label className="form-label text-xs">
                        Product <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <select
                        required
                        value={row.product_id}
                        onChange={(e) => handleRowChange(idx, 'product_id', e.target.value)}
                        className="select-field text-xs py-2"
                        disabled={loading || fetchingData}
                      >
                        <option value="">Select Product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.product_code}) — Qty: {p.quantity}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group mb-0">
                      <label className="form-label text-xs">
                        Product Variant <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <select
                        required
                        value={row.product_variant_id}
                        onChange={(e) =>
                          handleRowChange(idx, 'product_variant_id', e.target.value)
                        }
                        className="select-field text-xs py-2"
                        disabled={loading || fetchingData || !row.product_id}
                      >
                        <option value="">
                          {row.product_id ? 'Select Variant' : 'Select product first'}
                        </option>
                        {productVariants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.variant_name} ({v.variant_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Movement Type, Quantity Base, Auto-Calculated Remaining Quantity, Reference Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="form-group mb-0">
                      <label className="form-label text-xs">
                        Movement Type <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <select
                        required
                        value={row.movement_type}
                        onChange={(e) =>
                          handleRowChange(
                            idx,
                            'movement_type',
                            e.target.value as StockMovementType
                          )
                        }
                        className="select-field text-xs py-2"
                        disabled={loading}
                      >
                        <option value="in">in (+)</option>
                        <option value="out">out (-)</option>
                      </select>
                    </div>

                    <div className="form-group mb-0">
                      <label className="form-label text-xs">
                        Quantity Base <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        required
                        value={row.quantity_base}
                        onChange={(e) => handleRowChange(idx, 'quantity_base', e.target.value)}
                        placeholder="0.000"
                        className="input-field text-xs py-2 font-mono font-semibold"
                        disabled={loading}
                      />
                    </div>

                    <div className="form-group mb-0">
                      <label className="form-label text-xs">
                        Remaining Quantity (Auto)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={
                          calc.remainingQty !== null ? String(calc.remainingQty) : '—'
                        }
                        className="input-field text-xs py-2 font-mono font-bold text-[var(--color-brand-deep-green)] bg-[var(--color-primary-light)]"
                      />
                    </div>

                    <div className="form-group mb-0">
                      <label className="form-label text-xs">
                        Reference Type <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <select
                        required
                        value={row.reference_type}
                        onChange={(e) =>
                          handleRowChange(
                            idx,
                            'reference_type',
                            e.target.value as StockReferenceType
                          )
                        }
                        className="select-field text-xs py-2"
                        disabled={loading}
                      >
                        <option value="adjustment">adjustment</option>
                        <option value="opening_stock">opening_stock</option>
                        <option value="purchase">purchase</option>
                        <option value="sale">sale</option>
                        <option value="return">return</option>
                      </select>
                    </div>
                  </div>

                  {/* Reference ID & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-group mb-0">
                      <label className="form-label text-xs">
                        Reference ID (Optional UUID)
                      </label>
                      <input
                        type="text"
                        value={row.reference_id}
                        onChange={(e) => handleRowChange(idx, 'reference_id', e.target.value)}
                        placeholder="Optional reference UUID"
                        className="input-field font-mono text-xs py-2"
                        disabled={loading}
                      />
                    </div>

                    <div className="form-group mb-0">
                      <label className="form-label text-xs">Notes</label>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                        placeholder="Optional movement notes..."
                        className="input-field text-xs py-2"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
              disabled={loading || fetchingData}
              className="btn btn-primary min-w-[120px]"
            >
              {loading ? 'Saving...' : `Save (${rows.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
