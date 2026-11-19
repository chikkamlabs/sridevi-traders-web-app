import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getProducts } from '@/lib/productsStore';

export type StockMovementType = 'in' | 'out';

export interface StockMovement {
  id: string;
  firm_id: string;
  product_id: string;
  product_variant_id: string;
  product_name: string;
  product_code: string;
  movement_type: StockMovementType;
  quantity_base: number;
  remaining_quantity: number | null;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

const LOCAL_STOCK_MOVEMENTS_KEY = 'st_stock_movements_cache';

function getLocalStockMovements(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STOCK_MOVEMENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as any[];
  } catch {
    return [];
  }
}

function saveLocalStockMovements(movements: StockMovement[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STOCK_MOVEMENTS_KEY, JSON.stringify(movements));
  } catch (err) {
    console.error('Failed to save stock movements locally:', err);
  }
}

function toLocalDateString(isoDate?: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch stock_movements from Supabase (or local fallback) with optional date range & product search filter.
 */
export async function getStockMovements(options?: {
  fromDate?: string;
  toDate?: string;
  search?: string;
}): Promise<StockMovement[]> {
  let list: StockMovement[] = [];

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          id,
          firm_id,
          product_id,
          product_variant_id,
          movement_type,
          quantity_base,
          remaining_quantity,
          reference_type,
          reference_id,
          notes,
          created_at,
          updated_at,
          products ( name, product_code )
        `)
        .order('created_at', { ascending: false });

      if (options?.fromDate) {
        const start = new Date(`${options.fromDate}T00:00:00`);
        if (!isNaN(start.getTime())) {
          query = query.gte('created_at', start.toISOString());
        }
      }
      if (options?.toDate) {
        const end = new Date(`${options.toDate}T23:59:59.999`);
        if (!isNaN(end.getTime())) {
          query = query.lte('created_at', end.toISOString());
        }
      }

      const { data, error } = await query;

      if (!error && data) {
        list = data.map((row: any) => ({
          id: row.id,
          firm_id: row.firm_id,
          product_id: row.product_id,
          product_variant_id: row.product_variant_id,
          product_name: row.products?.name || 'Product',
          product_code: row.products?.product_code || '',
          movement_type: row.movement_type === 'in' ? 'in' : 'out',
          quantity_base: Number(row.quantity_base || 0),
          remaining_quantity:
            row.remaining_quantity !== null && row.remaining_quantity !== undefined
              ? Number(row.remaining_quantity)
              : null,
          reference_type: row.reference_type,
          reference_id: row.reference_id || null,
          notes: row.notes || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        if (!options?.fromDate && !options?.toDate) {
          saveLocalStockMovements(list);
        }
      } else {
        const products = await getProducts();
        const prodMap = new Map(products.map((p) => [p.id, p]));
        list = getLocalStockMovements().map((row: any) => {
          const prod = prodMap.get(row.product_id);
          return {
            ...row,
            product_name: row.product_name || prod?.name || 'Product',
            product_code: row.product_code || prod?.product_code || '',
            movement_type: row.movement_type === 'in' ? 'in' : 'out',
            quantity_base: Number(row.quantity_base || 0),
            remaining_quantity:
              row.remaining_quantity !== null && row.remaining_quantity !== undefined
                ? Number(row.remaining_quantity)
                : null,
          };
        });
      }
    } catch (err) {
      console.warn('Error fetching stock movements from Supabase:', err);
      const products = await getProducts();
      const prodMap = new Map(products.map((p) => [p.id, p]));
      list = getLocalStockMovements().map((row: any) => {
        const prod = prodMap.get(row.product_id);
        return {
          ...row,
          product_name: row.product_name || prod?.name || 'Product',
          product_code: row.product_code || prod?.product_code || '',
          movement_type: row.movement_type === 'in' ? 'in' : 'out',
          quantity_base: Number(row.quantity_base || 0),
          remaining_quantity:
            row.remaining_quantity !== null && row.remaining_quantity !== undefined
              ? Number(row.remaining_quantity)
              : null,
        };
      });
    }
  } else {
    const products = await getProducts();
    const prodMap = new Map(products.map((p) => [p.id, p]));
    list = getLocalStockMovements().map((row: any) => {
      const prod = prodMap.get(row.product_id);
      return {
        ...row,
        product_name: row.product_name || prod?.name || 'Product',
        product_code: row.product_code || prod?.product_code || '',
        movement_type: row.movement_type === 'in' ? 'in' : 'out',
        quantity_base: Number(row.quantity_base || 0),
        remaining_quantity:
          row.remaining_quantity !== null && row.remaining_quantity !== undefined
            ? Number(row.remaining_quantity)
            : null,
      };
    });
  }

  // Client-side date filtering for consistency across local/remote
  if (options?.fromDate) {
    list = list.filter((m) => toLocalDateString(m.created_at) >= options.fromDate!);
  }
  if (options?.toDate) {
    list = list.filter((m) => toLocalDateString(m.created_at) <= options.toDate!);
  }

  // Search filtering by product_code or product_name
  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.product_name.toLowerCase().includes(q) ||
        m.product_code.toLowerCase().includes(q)
    );
  }

  return list;
}

export type StockReferenceType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'return'
  | 'opening_stock';

export interface StockMovementInput {
  firm_id: string;
  product_id: string;
  product_variant_id: string;
  movement_type: StockMovementType;
  quantity_base: number;
  reference_type: StockReferenceType;
  reference_id?: string | null;
  notes?: string | null;
}

/**
 * Insert multiple stock_movements rows, calculating remaining_quantity sequentially
 * from products.quantity (+ quantity_base if 'in', - quantity_base if 'out'),
 * and update products.quantity = remaining_quantity.
 */
export async function addStockMovements(
  inputs: StockMovementInput[]
): Promise<{ data: StockMovement[] | null; error: string | null }> {
  if (!inputs || inputs.length === 0) {
    return { data: null, error: 'At least one stock movement row is required.' };
  }

  for (let i = 0; i < inputs.length; i++) {
    const row = inputs[i];
    if (!row.firm_id) {
      return { data: null, error: `Row #${i + 1}: Please select a firm.` };
    }
    if (!row.product_id) {
      return { data: null, error: `Row #${i + 1}: Please select a product.` };
    }
    if (!row.product_variant_id) {
      return { data: null, error: `Row #${i + 1}: Please select a product variant.` };
    }
    if (row.movement_type !== 'in' && row.movement_type !== 'out') {
      return { data: null, error: `Row #${i + 1}: Movement type must be 'in' or 'out'.` };
    }
    const qty = Number(row.quantity_base);
    if (isNaN(qty) || qty <= 0) {
      return { data: null, error: `Row #${i + 1}: Quantity base must be greater than 0.` };
    }
    if (!row.reference_type) {
      return { data: null, error: `Row #${i + 1}: Reference type is required.` };
    }
  }

  const allProducts = await getProducts();
  const prodMetaMap = new Map(allProducts.map((p) => [p.id, p]));
  const uniqueProductIds = Array.from(new Set(inputs.map((r) => r.product_id)));
  const runningQtyByProduct = new Map<string, number>();

  if (isSupabaseConfigured) {
    try {
      // 1. Fetch fresh products.quantity for each affected product
      for (const productId of uniqueProductIds) {
        const { data: prodRow, error: prodErr } = await supabase
          .from('products')
          .select('id, quantity, name, product_code')
          .eq('id', productId)
          .single();

        if (prodErr || !prodRow) {
          return {
            data: null,
            error: prodErr?.message || 'Failed to fetch product quantity.',
          };
        }
        runningQtyByProduct.set(productId, Number(prodRow.quantity || 0));
      }

      // 2. Calculate remaining_quantity for each row sequentially
      const rowsToInsert = inputs.map((row) => {
        const currentQty = runningQtyByProduct.get(row.product_id) ?? 0;
        const baseQty = Number(row.quantity_base);
        const remainingQty =
          row.movement_type === 'in'
            ? Number((currentQty + baseQty).toFixed(3))
            : Number((currentQty - baseQty).toFixed(3));
        runningQtyByProduct.set(row.product_id, remainingQty);

        return {
          firm_id: row.firm_id,
          product_id: row.product_id,
          product_variant_id: row.product_variant_id,
          movement_type: row.movement_type,
          quantity_base: baseQty,
          remaining_quantity: remainingQty,
          reference_type: row.reference_type,
          reference_id: row.reference_id?.trim() || null,
          notes: row.notes?.trim() || null,
        };
      });

      // 3. Insert multiple rows into stock_movements
      const { data: insertedRows, error: insertErr } = await supabase
        .from('stock_movements')
        .insert(rowsToInsert)
        .select();

      if (insertErr || !insertedRows) {
        return {
          data: null,
          error: insertErr?.message || 'Failed to insert stock movements.',
        };
      }

      // 4. Update products.quantity = remaining_quantity for each affected product
      const nowIso = new Date().toISOString();
      for (const [productId, newQty] of runningQtyByProduct.entries()) {
        const { error: updateErr } = await supabase
          .from('products')
          .update({
            quantity: newQty,
            updated_at: nowIso,
          })
          .eq('id', productId);

        if (updateErr) {
          return { data: null, error: updateErr.message };
        }
      }

      const formatted: StockMovement[] = insertedRows.map((row: any) => {
        const prod = prodMetaMap.get(row.product_id);
        return {
          id: row.id,
          firm_id: row.firm_id,
          product_id: row.product_id,
          product_variant_id: row.product_variant_id,
          product_name: prod?.name || 'Product',
          product_code: prod?.product_code || '',
          movement_type: row.movement_type === 'in' ? 'in' : 'out',
          quantity_base: Number(row.quantity_base || 0),
          remaining_quantity:
            row.remaining_quantity !== null && row.remaining_quantity !== undefined
              ? Number(row.remaining_quantity)
              : null,
          reference_type: row.reference_type,
          reference_id: row.reference_id || null,
          notes: row.notes || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      // Sync local caches
      if (typeof window !== 'undefined') {
        try {
          const rawProducts = localStorage.getItem('st_products_cache');
          if (rawProducts) {
            const localProducts = JSON.parse(rawProducts) as any[];
            const updatedLocalProducts = localProducts.map((p) =>
              runningQtyByProduct.has(p.id)
                ? { ...p, quantity: runningQtyByProduct.get(p.id), updated_at: nowIso }
                : p
            );
            localStorage.setItem('st_products_cache', JSON.stringify(updatedLocalProducts));
          }
        } catch {
          // ignore local cache sync errors
        }
        saveLocalStockMovements([...formatted, ...getLocalStockMovements()]);
      }

      return { data: formatted, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exception inserting stock movements.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  for (const productId of uniqueProductIds) {
    const prod = prodMetaMap.get(productId);
    runningQtyByProduct.set(productId, Number(prod?.quantity || 0));
  }

  const nowIso = new Date().toISOString();
  const localMovements: StockMovement[] = inputs.map((row) => {
    const prod = prodMetaMap.get(row.product_id);
    const currentQty = runningQtyByProduct.get(row.product_id) ?? 0;
    const baseQty = Number(row.quantity_base);
    const remainingQty =
      row.movement_type === 'in'
        ? Number((currentQty + baseQty).toFixed(3))
        : Number((currentQty - baseQty).toFixed(3));
    runningQtyByProduct.set(row.product_id, remainingQty);

    return {
      id: 'smov-' + Math.random().toString(36).substring(2, 10),
      firm_id: row.firm_id,
      product_id: row.product_id,
      product_variant_id: row.product_variant_id,
      product_name: prod?.name || 'Product',
      product_code: prod?.product_code || '',
      movement_type: row.movement_type,
      quantity_base: baseQty,
      remaining_quantity: remainingQty,
      reference_type: row.reference_type,
      reference_id: row.reference_id?.trim() || null,
      notes: row.notes?.trim() || null,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  if (typeof window !== 'undefined') {
    try {
      const rawProducts = localStorage.getItem('st_products_cache');
      if (rawProducts) {
        const localProducts = JSON.parse(rawProducts) as any[];
        const updatedLocalProducts = localProducts.map((p) =>
          runningQtyByProduct.has(p.id)
            ? { ...p, quantity: runningQtyByProduct.get(p.id), updated_at: nowIso }
            : p
        );
        localStorage.setItem('st_products_cache', JSON.stringify(updatedLocalProducts));
      }
    } catch {
      // ignore
    }
  }

  saveLocalStockMovements([...localMovements, ...getLocalStockMovements()]);
  return { data: localMovements, error: null };
}
