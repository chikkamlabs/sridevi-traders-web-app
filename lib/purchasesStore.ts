import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';
import { getSuppliers } from '@/lib/suppliersStore';
import { getProducts } from '@/lib/productsStore';
import { getAllProductVariants } from '@/lib/productvariantsStore';

export interface PurchaseItem {
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

export interface PurchaseItemInput {
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
  n_gst_unit_price?: number;
  n_gst_total_price?: number;
}

export interface Purchase {
  id: string;
  firm_id: string;
  supplier_id: string;
  invoice_number: string;
  purchase_number: string;
  date: string;
  gst_subtotal: number;
  n_gst_subtotal: number;
  tax_amount: number;
  extra_charges: number;
  gst_total: number;
  n_gst_total: number;
  grand_total: number;
  notes: string | null;
  created_by?: string | null;
  firm_name?: string;
  supplier_name?: string;
  supplier_code?: string;
  items?: PurchaseItem[];
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseInput {
  firm_id: string;
  supplier_id: string;
  invoice_number: string;
  purchase_number?: string;
  date: string;
  gst_subtotal: number;
  n_gst_subtotal?: number;
  tax_amount: number;
  extra_charges?: number;
  gst_total: number;
  n_gst_total?: number;
  grand_total?: number;
  notes?: string;
}

const LOCAL_PURCHASES_KEY = 'st_purchases_cache';
const LOCAL_PURCHASE_ITEMS_KEY = 'st_purchase_items_cache';

export function generatePurchaseNumber(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `purchase_${random4}`;
}

function getLocalPurchases(): Purchase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PURCHASES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Purchase[];
  } catch {
    return [];
  }
}

function saveLocalPurchases(purchases: Purchase[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_PURCHASES_KEY, JSON.stringify(purchases));
  } catch (err) {
    console.error('Failed to save purchases locally:', err);
  }
}

function getLocalPurchaseItems(): PurchaseItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PURCHASE_ITEMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PurchaseItem[];
  } catch {
    return [];
  }
}

function saveLocalPurchaseItems(items: PurchaseItem[]): void {
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
export async function getPurchases(options?: {
  fromDate?: string;
  toDate?: string;
  search?: string;
}): Promise<Purchase[]> {
  let list: Purchase[] = [];

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
          extra_charges,
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
          extra_charges: Number(row.extra_charges || 0),
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
      console.warn('Error fetching purchases from Supabase:', err);
      list = getLocalPurchases();
    }
  } else {
    list = getLocalPurchases();
  }

  // Client-side date filtering (handles local fallback & ensures consistency)
  if (options?.fromDate) {
    list = list.filter((p) => p.date >= options.fromDate!);
  }
  if (options?.toDate) {
    list = list.filter((p) => p.date <= options.toDate!);
  }

  // Search filtering by purchase_number and invoice_number
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
export async function getPurchaseById(id: string): Promise<Purchase | null> {
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
          extra_charges,
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

        const formattedItems: PurchaseItem[] = (itemsData || []).map((item: any) => ({
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
          extra_charges: Number(p.extra_charges || 0),
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
      console.warn('Error fetching purchase by ID from Supabase:', err);
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
 * Insert a new purchase and its purchase_items into Supabase (or local fallback).
 */
export async function addPurchase(
  purchaseInput: PurchaseInput,
  itemsInput: PurchaseItemInput[]
): Promise<{ data: Purchase | null; error: string | null }> {
  if (!purchaseInput.firm_id) {
    return { data: null, error: 'Please select a firm.' };
  }
  if (!purchaseInput.supplier_id) {
    return { data: null, error: 'Please select a supplier.' };
  }
  if (!purchaseInput.invoice_number.trim()) {
    return { data: null, error: 'Invoice number is required.' };
  }
  if (!purchaseInput.date) {
    return { data: null, error: 'Purchase date is required.' };
  }
  if (!itemsInput || itemsInput.length === 0) {
    return { data: null, error: 'Please add at least one purchase item.' };
  }

  const purchase_number =
    purchaseInput.purchase_number?.trim() || generatePurchaseNumber();
  const gstSubtotal = Number(purchaseInput.gst_subtotal || 0);
  const taxAmount = Number(purchaseInput.tax_amount || 0);
  const extraCharges = Number(purchaseInput.extra_charges || 0);
  const gstTotal = Number(purchaseInput.gst_total || 0);
  const grandTotal =
    purchaseInput.grand_total !== undefined
      ? Number(purchaseInput.grand_total)
      : gstTotal;

  if (gstTotal <= 0) {
    return { data: null, error: 'Purchase total (gst_total) must be greater than 0.' };
  }

  const purchasePayload = {
    firm_id: purchaseInput.firm_id,
    supplier_id: purchaseInput.supplier_id,
    invoice_number: purchaseInput.invoice_number.trim(),
    purchase_number,
    date: purchaseInput.date,
    gst_subtotal: gstSubtotal,
    n_gst_subtotal: Number(purchaseInput.n_gst_subtotal || 0),
    tax_amount: taxAmount,
    extra_charges: extraCharges,
    gst_total: gstTotal,
    n_gst_total: Number(purchaseInput.n_gst_total || 0),
    grand_total: grandTotal,
    notes: purchaseInput.notes?.trim() || null,
  };

  if (isSupabaseConfigured) {
    try {
      // 1. Insert purchase
      const { data: createdPurchase, error: purchaseErr } = await supabase
        .from('purchases')
        .insert([purchasePayload])
        .select()
        .single();

      if (purchaseErr || !createdPurchase) {
        return {
          data: null,
          error: purchaseErr?.message || 'Failed to save purchase.',
        };
      }

      // 2. Insert purchase_items
      const itemPayloads = itemsInput.map((item) => ({
        purchase_id: createdPurchase.id,
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: Number(item.quantity),
        conversion_factor: Number(item.conversion_factor),
        base_quantity: Number(item.base_quantity),
        gst_unit_price: Number(item.gst_unit_price || 0),
        mrp: Number(item.mrp || 0),
        discount_rate: Number(item.discount_rate || 0),
        discount_amount: Number(item.discount_amount || 0),
        tax_rate: Number(item.tax_rate || 0),
        tax_amount: Number(item.tax_amount || 0),
        gst_total_price: Number(item.gst_total_price || 0),
        n_gst_unit_price: Number(item.n_gst_unit_price || 0),
        n_gst_total_price: Number(item.n_gst_total_price || 0),
      }));

      const { data: createdItems, error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(itemPayloads)
        .select();

      if (itemsErr) {
        // Rollback purchase if items insert fails
        await supabase.from('purchases').delete().eq('id', createdPurchase.id);
        return { data: null, error: itemsErr.message };
      }

      const formattedPurchase: Purchase = {
        id: createdPurchase.id,
        firm_id: createdPurchase.firm_id,
        supplier_id: createdPurchase.supplier_id,
        invoice_number: createdPurchase.invoice_number,
        purchase_number: createdPurchase.purchase_number,
        date: createdPurchase.date,
        gst_subtotal: Number(createdPurchase.gst_subtotal),
        n_gst_subtotal: Number(createdPurchase.n_gst_subtotal),
        tax_amount: Number(createdPurchase.tax_amount),
        extra_charges: Number(createdPurchase.extra_charges || 0),
        gst_total: Number(createdPurchase.gst_total),
        n_gst_total: Number(createdPurchase.n_gst_total),
        grand_total: Number(createdPurchase.grand_total),
        notes: createdPurchase.notes,
        created_at: createdPurchase.created_at,
        updated_at: createdPurchase.updated_at,
        items: (createdItems || []).map((it: any) => ({
          id: it.id,
          purchase_id: it.purchase_id,
          product_id: it.product_id,
          product_variant_id: it.product_variant_id,
          quantity: Number(it.quantity),
          conversion_factor: Number(it.conversion_factor),
          base_quantity: Number(it.base_quantity),
          gst_unit_price: Number(it.gst_unit_price),
          mrp: Number(it.mrp),
          discount_rate: Number(it.discount_rate),
          discount_amount: Number(it.discount_amount),
          tax_rate: Number(it.tax_rate),
          tax_amount: Number(it.tax_amount),
          gst_total_price: Number(it.gst_total_price),
          n_gst_unit_price: Number(it.n_gst_unit_price),
          n_gst_total_price: Number(it.n_gst_total_price),
          created_at: it.created_at,
          updated_at: it.updated_at,
        })),
      };

      const localPurchases = getLocalPurchases();
      saveLocalPurchases([formattedPurchase, ...localPurchases]);
      if (formattedPurchase.items) {
        const localItems = getLocalPurchaseItems();
        saveLocalPurchaseItems([...localItems, ...formattedPurchase.items]);
      }

      return { data: formattedPurchase, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exception saving purchase.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newPurchaseId = 'pur-' + Math.random().toString(36).substring(2, 10);
  const nowIso = new Date().toISOString();

  const [firms, suppliers] = await Promise.all([getFirms(), getSuppliers()]);
  const firm = firms.find((f) => f.id === purchaseInput.firm_id);
  const supplier = suppliers.find((s) => s.id === purchaseInput.supplier_id);

  const localItems: PurchaseItem[] = itemsInput.map((item) => ({
    id: 'pit-' + Math.random().toString(36).substring(2, 10),
    purchase_id: newPurchaseId,
    product_id: item.product_id,
    product_variant_id: item.product_variant_id,
    quantity: Number(item.quantity),
    conversion_factor: Number(item.conversion_factor),
    base_quantity: Number(item.base_quantity),
    gst_unit_price: Number(item.gst_unit_price || 0),
    mrp: Number(item.mrp || 0),
    discount_rate: Number(item.discount_rate || 0),
    discount_amount: Number(item.discount_amount || 0),
    tax_rate: Number(item.tax_rate || 0),
    tax_amount: Number(item.tax_amount || 0),
    gst_total_price: Number(item.gst_total_price || 0),
    n_gst_unit_price: Number(item.n_gst_unit_price || 0),
    n_gst_total_price: Number(item.n_gst_total_price || 0),
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const localPurchase: Purchase = {
    id: newPurchaseId,
    ...purchasePayload,
    firm_name: firm?.name || 'Firm',
    supplier_name: supplier?.name || 'Supplier',
    supplier_code: supplier?.supplier_code || '',
    items: localItems,
    created_at: nowIso,
    updated_at: nowIso,
  };

  saveLocalPurchases([localPurchase, ...getLocalPurchases()]);
  saveLocalPurchaseItems([...getLocalPurchaseItems(), ...localItems]);

  return { data: localPurchase, error: null };
}

/**
 * Update products.quantity (+ base_quantity) and insert stock_movements
 * (movement_type = 'in', quantity_base = base_quantity, remaining_quantity = products.quantity + base_quantity, reference_type = 'purchase')
 * for each purchase item.
 */
export async function applyPurchaseStockAndMovements(params: {
  firm_id: string;
  purchase_id: string;
  purchase_number: string;
  items: PurchaseItemInput[];
}): Promise<{ success: boolean; error: string | null }> {
  const { firm_id, purchase_id, purchase_number, items } = params;

  const uniqueProductIds = Array.from(new Set(items.map((item) => item.product_id)));
  const runningQtyByProduct = new Map<string, number>();

  if (isSupabaseConfigured) {
    try {
      // 1. Fetch current products.quantity for all affected products
      for (const productId of uniqueProductIds) {
        const { data: prodRow, error: prodFetchErr } = await supabase
          .from('products')
          .select('id, quantity')
          .eq('id', productId)
          .single();

        if (prodFetchErr || !prodRow) {
          return {
            success: false,
            error: prodFetchErr?.message || 'Failed to fetch product for quantity update.',
          };
        }

        runningQtyByProduct.set(productId, Number(prodRow.quantity || 0));
      }

      // 2. Compute remaining_quantity for each item and build stock_movements rows
      const movementRows = items.map((item) => {
        const currentQty = runningQtyByProduct.get(item.product_id) || 0;
        const baseQty = Number(item.base_quantity || 0);
        const nextQty = Number((currentQty + baseQty).toFixed(3));
        runningQtyByProduct.set(item.product_id, nextQty);

        return {
          firm_id,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          movement_type: 'in',
          quantity_base: baseQty,
          remaining_quantity: nextQty,
          reference_type: 'purchase',
          reference_id: purchase_id,
          notes: `Purchase ${purchase_number}`,
        };
      });

      // 3. Update products.quantity with the new total for each product
      for (const [productId, newQuantity] of runningQtyByProduct.entries()) {
        const { error: prodUpdateErr } = await supabase
          .from('products')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId);

        if (prodUpdateErr) {
          return { success: false, error: prodUpdateErr.message };
        }
      }

      // 4. Insert stock_movements for each purchase item
      const { error: movErr } = await supabase
        .from('stock_movements')
        .insert(movementRows);

      if (movErr) {
        return { success: false, error: movErr.message };
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update product stock and movements.';
      return { success: false, error: msg };
    }
  }

  // Update local products & stock_movements caches if present
  if (typeof window !== 'undefined') {
    try {
      const rawProducts = localStorage.getItem('st_products_cache');
      const localProducts: any[] = rawProducts ? JSON.parse(rawProducts) : [];
      const localQtyMap = new Map<string, number>();

      if (isSupabaseConfigured) {
        for (const [productId, qty] of runningQtyByProduct.entries()) {
          localQtyMap.set(productId, qty);
        }
      } else {
        for (const productId of uniqueProductIds) {
          const found = localProducts.find((p) => p.id === productId);
          localQtyMap.set(productId, Number(found?.quantity || 0));
        }

        const nowIso = new Date().toISOString();
        const localMovements = items.map((item) => {
          const currentQty = localQtyMap.get(item.product_id) || 0;
          const baseQty = Number(item.base_quantity || 0);
          const nextQty = Number((currentQty + baseQty).toFixed(3));
          localQtyMap.set(item.product_id, nextQty);
          return {
            id: 'smv-' + Math.random().toString(36).substring(2, 10),
            firm_id,
            product_id: item.product_id,
            product_variant_id: item.product_variant_id,
            movement_type: 'in',
            quantity_base: baseQty,
            remaining_quantity: nextQty,
            reference_type: 'purchase',
            reference_id: purchase_id,
            notes: `Purchase ${purchase_number}`,
            created_at: nowIso,
            updated_at: nowIso,
          };
        });

        const rawMov = localStorage.getItem('st_stock_movements_cache');
        const existingMov: any[] = rawMov ? JSON.parse(rawMov) : [];
        localStorage.setItem(
          'st_stock_movements_cache',
          JSON.stringify([...localMovements, ...existingMov])
        );
      }

      if (rawProducts) {
        const updatedProducts = localProducts.map((p) => {
          const updatedQty = localQtyMap.get(p.id);
          if (updatedQty !== undefined) {
            return {
              ...p,
              quantity: updatedQty,
              updated_at: new Date().toISOString(),
            };
          }
          return p;
        });
        localStorage.setItem('st_products_cache', JSON.stringify(updatedProducts));
      }
    } catch (err) {
      console.warn('Failed to update local products cache:', err);
    }
  }

  return { success: true, error: null };
}

