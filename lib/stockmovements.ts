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
