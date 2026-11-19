import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';
import { getSuppliers } from '@/lib/suppliersStore';
import { getProducts } from '@/lib/productsStore';
import { getAllProductVariants } from '@/lib/productvariantsStore';

export interface SimplePurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
  conversion_factor: number;
  base_quantity: number;
  gst_unit_price: number;
  mrp: number;
  discount_rate: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  gst_total_price: number;
  n_gst_unit_price: number;
  n_gst_total_price: number;
  product_name?: string;
  product_code?: string;
  hsn_code?: string;
  variant_name?: string;
  variant_code?: string;
  base_unit_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SimplePurchase {
  id: string;
  firm_id: string;
  supplier_id: string;
  invoice_number: string;
  purchase_number: string;
  date: string;
  gst_subtotal: number;
  n_gst_subtotal: number;
  tax_amount: number;
  gst_total: number;
  n_gst_total: number;
  grand_total: number;
  notes: string | null;
  created_by?: string | null;
  firm_name?: string;
  supplier_name?: string;
  supplier_code?: string;
  items?: SimplePurchaseItem[];
  created_at?: string;
  updated_at?: string;
}

const LOCAL_PURCHASES_KEY = 'st_purchases_cache';
const LOCAL_PURCHASE_ITEMS_KEY = 'st_purchase_items_cache';

function getLocalPurchases(): SimplePurchase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PURCHASES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimplePurchase[];
  } catch {
    return [];
  }
}

function saveLocalPurchases(purchases: SimplePurchase[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_PURCHASES_KEY, JSON.stringify(purchases));
  } catch (err) {
    console.error('Failed to save purchases locally:', err);
  }
}

function getLocalPurchaseItems(): SimplePurchaseItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PURCHASE_ITEMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimplePurchaseItem[];
  } catch {
    return [];
  }
}

function saveLocalPurchaseItems(items: SimplePurchaseItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_PURCHASE_ITEMS_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save purchase items locally:', err);
  }
}

/**
 * Fetch purchases from Supabase (or local fallback) with optional date range & search filter.
 */
export async function getSimplePurchases(options?: {
  fromDate?: string;
  toDate?: string;
  search?: string;
}): Promise<SimplePurchase[]> {
  let list: SimplePurchase[] = [];

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('purchases')
        .select(`
          id,
          firm_id,
          supplier_id,
          invoice_number,
          purchase_number,
          date,
          gst_subtotal,
          n_gst_subtotal,
          tax_amount,
          gst_total,
          n_gst_total,
          grand_total,
          notes,
          created_by,
          created_at,
          updated_at,
          firms ( name ),
          suppliers ( name, supplier_code )
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options?.fromDate) {
        query = query.gte('date', options.fromDate);
      }
      if (options?.toDate) {
        query = query.lte('date', options.toDate);
      }

      const { data, error } = await query;

      if (!error && data) {
        list = data.map((row: any) => ({
          id: row.id,
          firm_id: row.firm_id,
          supplier_id: row.supplier_id,
          invoice_number: row.invoice_number,
          purchase_number: row.purchase_number,
          date: row.date,
          gst_subtotal: Number(row.gst_subtotal || 0),
          n_gst_subtotal: Number(row.n_gst_subtotal || 0),
          tax_amount: Number(row.tax_amount || 0),
          gst_total: Number(row.gst_total || 0),
          n_gst_total: Number(row.n_gst_total || 0),
          grand_total: Number(row.grand_total || 0),
          notes: row.notes || null,
          created_by: row.created_by || null,
          firm_name: row.firms?.name || 'Firm',
          supplier_name: row.suppliers?.name || 'Supplier',
          supplier_code: row.suppliers?.supplier_code || '',
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        if (!options?.fromDate && !options?.toDate) {
          saveLocalPurchases(list);
        }
      } else {
        list = getLocalPurchases();
      }
    } catch (err) {
      console.warn('Error fetching simple purchases from Supabase:', err);
      list = getLocalPurchases();
    }
  } else {
    list = getLocalPurchases();
  }

  if (options?.fromDate) {
    list = list.filter((p) => p.date >= options.fromDate!);
  }
  if (options?.toDate) {
    list = list.filter((p) => p.date <= options.toDate!);
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.purchase_number.toLowerCase().includes(q) ||
        p.invoice_number.toLowerCase().includes(q)
    );
  }

  return list;
}

/**
 * Fetch a single purchase by ID along with its purchase_items and joined details.
 */
export async function getSimplePurchaseById(id: string): Promise<SimplePurchase | null> {
  if (!id) return null;

  if (isSupabaseConfigured) {
    try {
      const { data: purchaseData, error: purchaseErr } = await supabase
        .from('purchases')
        .select(`
          id,
          firm_id,
          supplier_id,
          invoice_number,
          purchase_number,
          date,
          gst_subtotal,
          n_gst_subtotal,
          tax_amount,
          gst_total,
          n_gst_total,
          grand_total,
          notes,
          created_by,
          created_at,
          updated_at,
          firms ( name ),
          suppliers ( name, supplier_code )
        `)
        .eq('id', id)
        .maybeSingle();

      if (!purchaseErr && purchaseData) {
        const { data: itemsData } = await supabase
          .from('purchase_items')
          .select(`
            id,
            purchase_id,
            product_id,
            product_variant_id,
            quantity,
            conversion_factor,
            base_quantity,
            gst_unit_price,
            mrp,
            discount_rate,
            discount_amount,
            tax_rate,
            tax_amount,
            gst_total_price,
            n_gst_unit_price,
            n_gst_total_price,
            created_at,
            updated_at,
            products ( name, product_code, hsn_code, units ( name ) ),
            product_variants ( variant_name, variant_code )
          `)
          .eq('purchase_id', id)
          .order('created_at', { ascending: true });

        const formattedItems: SimplePurchaseItem[] = (itemsData || []).map((item: any) => ({
          id: item.id,
          purchase_id: item.purchase_id,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          quantity: Number(item.quantity || 0),
          conversion_factor: Number(item.conversion_factor || 0),
          base_quantity: Number(item.base_quantity || 0),
          gst_unit_price: Number(item.gst_unit_price || 0),
          mrp: Number(item.mrp || 0),
          discount_rate: Number(item.discount_rate || 0),
          discount_amount: Number(item.discount_amount || 0),
          tax_rate: Number(item.tax_rate || 0),
          tax_amount: Number(item.tax_amount || 0),
          gst_total_price: Number(item.gst_total_price || 0),
          n_gst_unit_price: Number(item.n_gst_unit_price || 0),
          n_gst_total_price: Number(item.n_gst_total_price || 0),
          product_name: item.products?.name || 'Product',
          product_code: item.products?.product_code || '',
          hsn_code: item.products?.hsn_code || '',
          variant_name: item.product_variants?.variant_name || 'Variant',
          variant_code: item.product_variants?.variant_code || '',
          base_unit_name: item.products?.units?.name || '',
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        const p: any = purchaseData;
        return {
          id: p.id,
          firm_id: p.firm_id,
          supplier_id: p.supplier_id,
          invoice_number: p.invoice_number,
          purchase_number: p.purchase_number,
          date: p.date,
          gst_subtotal: Number(p.gst_subtotal || 0),
          n_gst_subtotal: Number(p.n_gst_subtotal || 0),
          tax_amount: Number(p.tax_amount || 0),
          gst_total: Number(p.gst_total || 0),
          n_gst_total: Number(p.n_gst_total || 0),
          grand_total: Number(p.grand_total || 0),
          notes: p.notes || null,
          created_by: p.created_by || null,
          firm_name: p.firms?.name || 'Firm',
          supplier_name: p.suppliers?.name || 'Supplier',
          supplier_code: p.suppliers?.supplier_code || '',
          items: formattedItems,
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
      }
    } catch (err) {
      console.warn('Error fetching simple purchase by ID from Supabase:', err);
    }
  }

  // Local fallback
  const localPurchases = getLocalPurchases();
  const found = localPurchases.find((p) => p.id === id);
  if (!found) return null;

  const [firms, suppliers, products, variants] = await Promise.all([
    getFirms(),
    getSuppliers(),
    getProducts(),
    getAllProductVariants(),
  ]);

  const firm = firms.find((f) => f.id === found.firm_id);
  const supplier = suppliers.find((s) => s.id === found.supplier_id);
  const items = getLocalPurchaseItems()
    .filter((i) => i.purchase_id === id)
    .map((item) => {
      const prod = products.find((pr) => pr.id === item.product_id);
      const variant = variants.find((vr) => vr.id === item.product_variant_id);
      return {
        ...item,
        product_name: prod?.name || item.product_name || 'Product',
        product_code: prod?.product_code || item.product_code || '',
        hsn_code: prod?.hsn_code || item.hsn_code || '',
        variant_name: variant?.variant_name || item.variant_name || 'Variant',
        variant_code: variant?.variant_code || item.variant_code || '',
        base_unit_name: prod?.unit_name || item.base_unit_name || '',
      };
    });

  return {
    ...found,
    firm_name: firm?.name || found.firm_name || 'Firm',
    supplier_name: supplier?.name || found.supplier_name || 'Supplier',
    supplier_code: supplier?.supplier_code || found.supplier_code || '',
    items,
  };
}

/**
 * Update n_gst_subtotal & n_gst_total on purchases and n_gst_unit_price & n_gst_total_price on purchase_items.
 */
export async function updateSimplePurchaseNGst(params: {
  purchaseId: string;
  n_gst_subtotal: number;
  n_gst_total: number;
  items: Array<{
    id: string;
    n_gst_unit_price: number;
    n_gst_total_price: number;
  }>;
}): Promise<{ success: boolean; error: string | null }> {
  const { purchaseId, n_gst_subtotal, n_gst_total, items } = params;

  if (!purchaseId) {
    return { success: false, error: 'Purchase ID is required.' };
  }

  if (n_gst_subtotal < 0 || n_gst_total < 0) {
    return { success: false, error: 'N-GST amounts cannot be negative.' };
  }

  for (const item of items) {
    if (item.n_gst_unit_price < 0 || item.n_gst_total_price < 0) {
      return { success: false, error: 'Item N-GST prices cannot be negative.' };
    }
  }

  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      const { error: purchaseErr } = await supabase
        .from('purchases')
        .update({
          n_gst_subtotal: Number(n_gst_subtotal),
          n_gst_total: Number(n_gst_total),
          updated_at: nowIso,
        })
        .eq('id', purchaseId);

      if (purchaseErr) {
        return { success: false, error: purchaseErr.message };
      }

      for (const item of items) {
        const { error: itemErr } = await supabase
          .from('purchase_items')
          .update({
            n_gst_unit_price: Number(item.n_gst_unit_price),
            n_gst_total_price: Number(item.n_gst_total_price),
            updated_at: nowIso,
          })
          .eq('id', item.id)
          .eq('purchase_id', purchaseId);

        if (itemErr) {
          return { success: false, error: itemErr.message };
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update N-GST purchase details.';
      return { success: false, error: msg };
    }
  }

  // Update local caches
  const localPurchases = getLocalPurchases();
  if (localPurchases.length > 0) {
    const updatedPurchases = localPurchases.map((p) =>
      p.id === purchaseId
        ? {
            ...p,
            n_gst_subtotal: Number(n_gst_subtotal),
            n_gst_total: Number(n_gst_total),
            updated_at: nowIso,
          }
        : p
    );
    saveLocalPurchases(updatedPurchases);
  }

  const localItems = getLocalPurchaseItems();
  if (localItems.length > 0) {
    const itemMap = new Map(items.map((it) => [it.id, it]));
    const updatedItems = localItems.map((it) => {
      const match = itemMap.get(it.id);
      if (match) {
        return {
          ...it,
          n_gst_unit_price: Number(match.n_gst_unit_price),
          n_gst_total_price: Number(match.n_gst_total_price),
          updated_at: nowIso,
        };
      }
      return it;
    });
    saveLocalPurchaseItems(updatedItems);
  }

  return { success: true, error: null };
}
