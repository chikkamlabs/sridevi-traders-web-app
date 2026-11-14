import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';
import { getDealers } from '@/lib/dealersStore';
import { getProducts } from '@/lib/productsStore';
import { getAllProductVariants } from '@/lib/productvariantsStore';

export interface SaleBillItem {
  id: string;
  sales_bill_id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
  conversion_factor: number;
  base_quantity: number;
  discount_amount: number;
  discount_rate: number;
  gst_unit_price: number;
  tax_rate: number;
  tax_amount: number;
  gst_total_price: number;
  n_gst_unit_price: number;
  n_gst_total_price: number;
  product_name?: string;
  product_code?: string;
  variant_name?: string;
  variant_code?: string;
  base_unit_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaleBillItemInput {
  product_id: string;
  product_variant_id: string;
  quantity: number;
  conversion_factor: number;
  base_quantity: number;
  discount_amount: number;
  discount_rate: number;
  gst_unit_price: number;
  tax_rate: number;
  tax_amount: number;
  gst_total_price: number;
  n_gst_unit_price?: number;
  n_gst_total_price?: number;
}

export interface SaleBill {
  id: string;
  firm_id: string;
  dealer_id: string;
  sale_number: string;
  invoice_number: string;
  date: string;
  gst_subtotal: number;
  n_gst_subtotal: number;
  tax_rate: number;
  tax_amount: number;
  gst_total: number;
  n_gst_total: number;
  grand_total: number;
  notes: string | null;
  created_by?: string | null;
  firm_name?: string;
  dealer_name?: string;
  dealer_phone?: string | null;
  items?: SaleBillItem[];
  created_at?: string;
  updated_at?: string;
}

export interface SaleBillInput {
  firm_id: string;
  dealer_id: string;
  sale_number?: string;
  invoice_number?: string;
  date: string;
  gst_subtotal: number;
  n_gst_subtotal?: number;
  tax_rate?: number;
  tax_amount: number;
  gst_total: number;
  n_gst_total?: number;
  grand_total?: number;
  notes?: string;
}

export interface RecentPurchaseRate {
  id: string;
  product_variant_id: string;
  variant_name: string;
  gst_unit_price: number;
  created_at?: string;
}

const LOCAL_SALES_BILLS_KEY = 'st_sales_bills_cache';
const LOCAL_SALES_BILL_ITEMS_KEY = 'st_sales_bill_items_cache';

export function generateSaleNumber(): string {
  const random5 = Math.floor(10000 + Math.random() * 90000);
  return `sale_${random5}`;
}

export function generateSaleInvoiceNumber(): string {
  const random5 = Math.floor(10000 + Math.random() * 90000);
  return `sale_inv_${random5}`;
}

function getLocalSalesBills(): SaleBill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SALES_BILLS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SaleBill[];
  } catch {
    return [];
  }
}

function saveLocalSalesBills(sales: SaleBill[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SALES_BILLS_KEY, JSON.stringify(sales));
  } catch (err) {
    console.error('Failed to save sales bills locally:', err);
  }
}

function getLocalSalesBillItems(): SaleBillItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SALES_BILL_ITEMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SaleBillItem[];
  } catch {
    return [];
  }
}

function saveLocalSalesBillItems(items: SaleBillItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SALES_BILL_ITEMS_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save sales bill items locally:', err);
  }
}

/**
 * Fetch sales bills from Supabase (or local fallback) with optional date range & search filter.
 */
export async function getSalesBills(options?: {
  fromDate?: string;
  toDate?: string;
  search?: string;
}): Promise<SaleBill[]> {
  let list: SaleBill[] = [];

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('sales_bills')
        .select(`
          id,
          firm_id,
          dealer_id,
          sale_number,
          invoice_number,
          date,
          gst_subtotal,
          n_gst_subtotal,
          tax_rate,
          tax_amount,
          gst_total,
          n_gst_total,
          grand_total,
          notes,
          created_by,
          created_at,
          updated_at,
          firms ( name ),
          dealers ( name, phone )
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
          dealer_id: row.dealer_id,
          sale_number: row.sale_number,
          invoice_number: row.invoice_number,
          date: row.date,
          gst_subtotal: Number(row.gst_subtotal || 0),
          n_gst_subtotal: Number(row.n_gst_subtotal || 0),
          tax_rate: Number(row.tax_rate || 0),
          tax_amount: Number(row.tax_amount || 0),
          gst_total: Number(row.gst_total || 0),
          n_gst_total: Number(row.n_gst_total || 0),
          grand_total: Number(row.grand_total || 0),
          notes: row.notes || null,
          created_by: row.created_by || null,
          firm_name: row.firms?.name || 'Firm',
          dealer_name: row.dealers?.name || 'Dealer',
          dealer_phone: row.dealers?.phone || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));

        if (!options?.fromDate && !options?.toDate) {
          saveLocalSalesBills(list);
        }
      } else {
        list = getLocalSalesBills();
      }
    } catch (err) {
      console.warn('Error fetching sales bills from Supabase:', err);
      list = getLocalSalesBills();
    }
  } else {
    list = getLocalSalesBills();
  }

  // Client-side date filtering
  if (options?.fromDate) {
    list = list.filter((s) => s.date >= options.fromDate!);
  }
  if (options?.toDate) {
    list = list.filter((s) => s.date <= options.toDate!);
  }

  // Search filtering by sale_number and invoice_number
  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    list = list.filter(
      (s) =>
        s.sale_number.toLowerCase().includes(q) ||
        s.invoice_number.toLowerCase().includes(q)
    );
  }

  return list;
}

/**
 * Fetch a single sale bill by ID along with its sales_bill_items and joined details.
 */
export async function getSaleBillById(id: string): Promise<SaleBill | null> {
  if (!id) return null;

  if (isSupabaseConfigured) {
    try {
      const { data: saleData, error: saleErr } = await supabase
        .from('sales_bills')
        .select(`
          id,
          firm_id,
          dealer_id,
          sale_number,
          invoice_number,
          date,
          gst_subtotal,
          n_gst_subtotal,
          tax_rate,
          tax_amount,
          gst_total,
          n_gst_total,
          grand_total,
          notes,
          created_by,
          created_at,
          updated_at,
          firms ( name ),
          dealers ( name, phone )
        `)
        .eq('id', id)
        .maybeSingle();

      if (!saleErr && saleData) {
        const { data: itemsData } = await supabase
          .from('sales_bill_items')
          .select(`
            id,
            sales_bill_id,
            product_id,
            product_variant_id,
            quantity,
            conversion_factor,
            base_quantity,
            discount_amount,
            discount_rate,
            gst_unit_price,
            tax_rate,
            tax_amount,
            gst_total_price,
            n_gst_unit_price,
            n_gst_total_price,
            created_at,
            updated_at,
            products ( name, product_code, units ( name ) ),
            product_variants ( variant_name, variant_code )
          `)
          .eq('sales_bill_id', id)
          .order('created_at', { ascending: true });

        const formattedItems: SaleBillItem[] = (itemsData || []).map((item: any) => ({
          id: item.id,
          sales_bill_id: item.sales_bill_id,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          quantity: Number(item.quantity || 0),
          conversion_factor: Number(item.conversion_factor || 0),
          base_quantity: Number(item.base_quantity || 0),
          discount_amount: Number(item.discount_amount || 0),
          discount_rate: Number(item.discount_rate || 0),
          gst_unit_price: Number(item.gst_unit_price || 0),
          tax_rate: Number(item.tax_rate || 0),
          tax_amount: Number(item.tax_amount || 0),
          gst_total_price: Number(item.gst_total_price || 0),
          n_gst_unit_price: Number(item.n_gst_unit_price || 0),
          n_gst_total_price: Number(item.n_gst_total_price || 0),
          product_name: item.products?.name || 'Product',
          product_code: item.products?.product_code || '',
          variant_name: item.product_variants?.variant_name || 'Variant',
          variant_code: item.product_variants?.variant_code || '',
          base_unit_name: item.products?.units?.name || '',
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        const s: any = saleData;
        return {
          id: s.id,
          firm_id: s.firm_id,
          dealer_id: s.dealer_id,
          sale_number: s.sale_number,
          invoice_number: s.invoice_number,
          date: s.date,
          gst_subtotal: Number(s.gst_subtotal || 0),
          n_gst_subtotal: Number(s.n_gst_subtotal || 0),
          tax_rate: Number(s.tax_rate || 0),
          tax_amount: Number(s.tax_amount || 0),
          gst_total: Number(s.gst_total || 0),
          n_gst_total: Number(s.n_gst_total || 0),
          grand_total: Number(s.grand_total || 0),
          notes: s.notes || null,
          created_by: s.created_by || null,
          firm_name: s.firms?.name || 'Firm',
          dealer_name: s.dealers?.name || 'Dealer',
          dealer_phone: s.dealers?.phone || null,
          items: formattedItems,
          created_at: s.created_at,
          updated_at: s.updated_at,
        };
      }
    } catch (err) {
      console.warn('Error fetching sale bill by ID from Supabase:', err);
    }
  }

  // Local fallback
  const localSales = getLocalSalesBills();
  const found = localSales.find((s) => s.id === id);
  if (!found) return null;

  const [firms, dealers, products, variants] = await Promise.all([
    getFirms(),
    getDealers(),
    getProducts(),
    getAllProductVariants(),
  ]);

  const firm = firms.find((f) => f.id === found.firm_id);
  const dealer = dealers.find((d) => d.id === found.dealer_id);
  const items = getLocalSalesBillItems()
    .filter((i) => i.sales_bill_id === id)
    .map((item) => {
      const prod = products.find((pr) => pr.id === item.product_id);
      const variant = variants.find((vr) => vr.id === item.product_variant_id);
      return {
        ...item,
        product_name: prod?.name || item.product_name || 'Product',
        product_code: prod?.product_code || item.product_code || '',
        variant_name: variant?.variant_name || item.variant_name || 'Variant',
        variant_code: variant?.variant_code || item.variant_code || '',
        base_unit_name: prod?.unit_name || item.base_unit_name || '',
      };
    });

  return {
    ...found,
    firm_name: firm?.name || found.firm_name || 'Firm',
    dealer_name: dealer?.name || found.dealer_name || 'Dealer',
    dealer_phone: dealer?.phone || found.dealer_phone || null,
    items,
  };
}

/**
 * Insert a new sale bill into sales_bills and its items into sales_bill_items.
 */
export async function addSaleBill(
  saleInput: SaleBillInput,
  itemsInput: SaleBillItemInput[]
): Promise<{ data: SaleBill | null; error: string | null }> {
  if (!saleInput.firm_id) {
    return { data: null, error: 'Please select a firm.' };
  }
  if (!saleInput.dealer_id) {
    return { data: null, error: 'Please select a dealer.' };
  }
  if (!saleInput.date) {
    return { data: null, error: 'Sale date is required.' };
  }
  if (!itemsInput || itemsInput.length === 0) {
    return { data: null, error: 'Please add at least one product item.' };
  }

  const sale_number = saleInput.sale_number?.trim() || generateSaleNumber();
  const invoice_number =
    saleInput.invoice_number?.trim() || generateSaleInvoiceNumber();
  const gstSubtotal = Number(saleInput.gst_subtotal || 0);
  const taxAmount = Number(saleInput.tax_amount || 0);
  const gstTotal = Number(saleInput.gst_total || 0);
  const grandTotal =
    saleInput.grand_total !== undefined
      ? Number(saleInput.grand_total)
      : gstTotal;

  if (gstTotal <= 0) {
    return { data: null, error: 'Sale total (gst_total) must be greater than 0.' };
  }

  const salePayload = {
    firm_id: saleInput.firm_id,
    dealer_id: saleInput.dealer_id,
    sale_number,
    invoice_number,
    date: saleInput.date,
    gst_subtotal: gstSubtotal,
    n_gst_subtotal: Number(saleInput.n_gst_subtotal || 0),
    tax_rate: Number(saleInput.tax_rate || 0),
    tax_amount: taxAmount,
    gst_total: gstTotal,
    n_gst_total: Number(saleInput.n_gst_total || 0),
    grand_total: grandTotal,
    notes: saleInput.notes?.trim() || null,
  };

  if (isSupabaseConfigured) {
    try {
      // 1. Insert sales_bills
      const { data: createdSale, error: saleErr } = await supabase
        .from('sales_bills')
        .insert([salePayload])
        .select()
        .single();

      if (saleErr || !createdSale) {
        return {
          data: null,
          error: saleErr?.message || 'Failed to save sale bill.',
        };
      }

      // 2. Insert sales_bill_items
      const itemPayloads = itemsInput.map((item) => ({
        sales_bill_id: createdSale.id,
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: Number(item.quantity),
        conversion_factor: Number(item.conversion_factor),
        base_quantity: Number(item.base_quantity),
        discount_amount: Number(item.discount_amount || 0),
        discount_rate: Number(item.discount_rate || 0),
        gst_unit_price: Number(item.gst_unit_price || 0),
        tax_rate: Number(item.tax_rate || 0),
        tax_amount: Number(item.tax_amount || 0),
        gst_total_price: Number(item.gst_total_price || 0),
        n_gst_unit_price: Number(item.n_gst_unit_price || 0),
        n_gst_total_price: Number(item.n_gst_total_price || 0),
      }));

      const { data: createdItems, error: itemsErr } = await supabase
        .from('sales_bill_items')
        .insert(itemPayloads)
        .select();

      if (itemsErr) {
        await supabase.from('sales_bills').delete().eq('id', createdSale.id);
        return { data: null, error: itemsErr.message };
      }

      const formattedSale: SaleBill = {
        id: createdSale.id,
        firm_id: createdSale.firm_id,
        dealer_id: createdSale.dealer_id,
        sale_number: createdSale.sale_number,
        invoice_number: createdSale.invoice_number,
        date: createdSale.date,
        gst_subtotal: Number(createdSale.gst_subtotal),
        n_gst_subtotal: Number(createdSale.n_gst_subtotal),
        tax_rate: Number(createdSale.tax_rate),
        tax_amount: Number(createdSale.tax_amount),
        gst_total: Number(createdSale.gst_total),
        n_gst_total: Number(createdSale.n_gst_total),
        grand_total: Number(createdSale.grand_total),
        notes: createdSale.notes,
        created_at: createdSale.created_at,
        updated_at: createdSale.updated_at,
        items: (createdItems || []).map((it: any) => ({
          id: it.id,
          sales_bill_id: it.sales_bill_id,
          product_id: it.product_id,
          product_variant_id: it.product_variant_id,
          quantity: Number(it.quantity),
          conversion_factor: Number(it.conversion_factor),
          base_quantity: Number(it.base_quantity),
          discount_amount: Number(it.discount_amount),
          discount_rate: Number(it.discount_rate),
          gst_unit_price: Number(it.gst_unit_price),
          tax_rate: Number(it.tax_rate),
          tax_amount: Number(it.tax_amount),
          gst_total_price: Number(it.gst_total_price),
          n_gst_unit_price: Number(it.n_gst_unit_price),
          n_gst_total_price: Number(it.n_gst_total_price),
          created_at: it.created_at,
          updated_at: it.updated_at,
        })),
      };

      saveLocalSalesBills([formattedSale, ...getLocalSalesBills()]);
      if (formattedSale.items) {
        saveLocalSalesBillItems([
          ...getLocalSalesBillItems(),
          ...formattedSale.items,
        ]);
      }

      return { data: formattedSale, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exception saving sale bill.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newSaleId = 'sal-' + Math.random().toString(36).substring(2, 10);
  const nowIso = new Date().toISOString();

  const [firms, dealers] = await Promise.all([getFirms(), getDealers()]);
  const firm = firms.find((f) => f.id === saleInput.firm_id);
  const dealer = dealers.find((d) => d.id === saleInput.dealer_id);

  const localItems: SaleBillItem[] = itemsInput.map((item) => ({
    id: 'sbi-' + Math.random().toString(36).substring(2, 10),
    sales_bill_id: newSaleId,
    product_id: item.product_id,
    product_variant_id: item.product_variant_id,
    quantity: Number(item.quantity),
    conversion_factor: Number(item.conversion_factor),
    base_quantity: Number(item.base_quantity),
    discount_amount: Number(item.discount_amount || 0),
    discount_rate: Number(item.discount_rate || 0),
    gst_unit_price: Number(item.gst_unit_price || 0),
    tax_rate: Number(item.tax_rate || 0),
    tax_amount: Number(item.tax_amount || 0),
    gst_total_price: Number(item.gst_total_price || 0),
    n_gst_unit_price: Number(item.n_gst_unit_price || 0),
    n_gst_total_price: Number(item.n_gst_total_price || 0),
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const localSale: SaleBill = {
    id: newSaleId,
    ...salePayload,
    firm_name: firm?.name || 'Firm',
    dealer_name: dealer?.name || 'Dealer',
    dealer_phone: dealer?.phone || null,
    items: localItems,
    created_at: nowIso,
    updated_at: nowIso,
  };

  saveLocalSalesBills([localSale, ...getLocalSalesBills()]);
  saveLocalSalesBillItems([...getLocalSalesBillItems(), ...localItems]);

  return { data: localSale, error: null };
}

/**
 * Fetch the last 5 purchase items for a specific product (variant name and gst_unit_price).
 */
export async function getLast5PurchaseItemsForProduct(
  productId: string
): Promise<RecentPurchaseRate[]> {
  if (!productId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          id,
          product_variant_id,
          gst_unit_price,
          created_at,
          product_variants ( variant_name )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          product_variant_id: row.product_variant_id,
          variant_name: row.product_variants?.variant_name || 'Variant',
          gst_unit_price: Number(row.gst_unit_price || 0),
          created_at: row.created_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching recent purchase items for product:', err);
    }
  }

  // Local fallback
  if (typeof window === 'undefined') return [];
  try {
    const rawItems = localStorage.getItem('st_purchase_items_cache');
    const items: any[] = rawItems ? JSON.parse(rawItems) : [];
    const variants = await getAllProductVariants();
    const variantMap = new Map(variants.map((v) => [v.id, v.variant_name]));

    return items
      .filter((it) => it.product_id === productId)
      .sort((a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || ''))
      )
      .slice(0, 5)
      .map((it) => ({
        id: it.id,
        product_variant_id: it.product_variant_id,
        variant_name:
          it.variant_name || variantMap.get(it.product_variant_id) || 'Variant',
        gst_unit_price: Number(it.gst_unit_price || 0),
        created_at: it.created_at,
      }));
  } catch {
    return [];
  }
}

/**
 * Update products.quantity (- base_quantity) and insert stock_movements
 * (movement_type = 'out', quantity_base = base_quantity, remaining_quantity = products.quantity - base_quantity, reference_type = 'sale')
 * for each sale item.
 */
export async function applySaleStockAndMovements(params: {
  firm_id: string;
  sales_bill_id: string;
  sale_number: string;
  items: SaleBillItemInput[];
}): Promise<{ success: boolean; error: string | null }> {
  const { firm_id, sales_bill_id, sale_number, items } = params;

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
            error:
              prodFetchErr?.message ||
              'Failed to fetch product for quantity update.',
          };
        }

        runningQtyByProduct.set(productId, Number(prodRow.quantity || 0));
      }

      // 2. Compute remaining_quantity for each item and build stock_movements rows
      const movementRows = items.map((item) => {
        const currentQty = runningQtyByProduct.get(item.product_id) || 0;
        const baseQty = Number(item.base_quantity || 0);
        const nextQty = Number((currentQty - baseQty).toFixed(3));
        runningQtyByProduct.set(item.product_id, nextQty);

        return {
          firm_id,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          movement_type: 'out',
          quantity_base: baseQty,
          remaining_quantity: nextQty,
          reference_type: 'sale',
          reference_id: sales_bill_id,
          notes: `Sale ${sale_number}`,
        };
      });

      // 3. Update products.quantity with the new remaining total for each product
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

      // 4. Insert stock_movements for each sale item
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
      const localProducts: Array<{
        id: string;
        quantity?: number;
        updated_at?: string;
      }> = rawProducts ? JSON.parse(rawProducts) : [];
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
          const nextQty = Number((currentQty - baseQty).toFixed(3));
          localQtyMap.set(item.product_id, nextQty);
          return {
            id: 'smv-' + Math.random().toString(36).substring(2, 10),
            firm_id,
            product_id: item.product_id,
            product_variant_id: item.product_variant_id,
            movement_type: 'out',
            quantity_base: baseQty,
            remaining_quantity: nextQty,
            reference_type: 'sale',
            reference_id: sales_bill_id,
            notes: `Sale ${sale_number}`,
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
        localStorage.setItem(
          'st_products_cache',
          JSON.stringify(updatedProducts)
        );
      }
    } catch (err) {
      console.warn('Failed to update local products cache:', err);
    }
  }

  return { success: true, error: null };
}

