import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';
import { getDealers } from '@/lib/dealersStore';
import { getProducts } from '@/lib/productsStore';
import { getAllProductVariants } from '@/lib/productvariantsStore';

export interface SimpleSaleBillItem {
  id: string;
  sales_bill_id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
  sale_unit?: string | null;
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
  hsn_code?: string;
  variant_name?: string;
  variant_code?: string;
  base_unit_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SimpleSaleBill {
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
  n_gst_old_balance?: number;
  n_gst_new_balance?: number;
  vehicle_number?: string | null;
  transporter_name?: string | null;
  notes: string | null;
  created_by?: string | null;
  firm_name?: string;
  dealer_name?: string;
  dealer_phone?: string | null;
  dealer_address?: string | null;
  dealer_city?: string | null;
  items?: SimpleSaleBillItem[];
  created_at?: string;
  updated_at?: string;
}

const LOCAL_SALES_BILLS_KEY = 'st_sales_bills_cache';
const LOCAL_SALES_BILL_ITEMS_KEY = 'st_sales_bill_items_cache';

function getLocalSalesBills(): SimpleSaleBill[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SALES_BILLS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleSaleBill[];
  } catch {
    return [];
  }
}

function saveLocalSalesBills(sales: SimpleSaleBill[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SALES_BILLS_KEY, JSON.stringify(sales));
  } catch (err) {
    console.error('Failed to save sales bills locally:', err);
  }
}

function getLocalSalesBillItems(): SimpleSaleBillItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SALES_BILL_ITEMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleSaleBillItem[];
  } catch {
    return [];
  }
}

function saveLocalSalesBillItems(items: SimpleSaleBillItem[]): void {
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
export async function getSimpleSalesBills(options?: {
  fromDate?: string;
  toDate?: string;
  search?: string;
}): Promise<SimpleSaleBill[]> {
  let list: SimpleSaleBill[] = [];

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
      console.warn('Error fetching simple sales bills from Supabase:', err);
      list = getLocalSalesBills();
    }
  } else {
    list = getLocalSalesBills();
  }

  if (options?.fromDate) {
    list = list.filter((s) => s.date >= options.fromDate!);
  }
  if (options?.toDate) {
    list = list.filter((s) => s.date <= options.toDate!);
  }

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
export async function getSimpleSaleBillById(id: string): Promise<SimpleSaleBill | null> {
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
          n_gst_old_balance,
          n_gst_new_balance,
          vehicle_number,
          transporter_name,
          notes,
          created_by,
          created_at,
          updated_at,
          firms ( name ),
          dealers ( name, phone, city, address )
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
            sale_unit,
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
            products ( name, product_code, hsn_code, units ( name ) ),
            product_variants ( variant_name, variant_code )
          `)
          .eq('sales_bill_id', id)
          .order('created_at', { ascending: true });

        const formattedItems: SimpleSaleBillItem[] = (itemsData || []).map((item: any) => ({
          id: item.id,
          sales_bill_id: item.sales_bill_id,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          quantity: Number(item.quantity || 0),
          sale_unit: item.sale_unit || null,
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
          hsn_code: item.products?.hsn_code || '',
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
          n_gst_old_balance: Number(s.n_gst_old_balance || 0),
          n_gst_new_balance: Number(s.n_gst_new_balance || 0),
          vehicle_number: s.vehicle_number || null,
          transporter_name: s.transporter_name || null,
          notes: s.notes || null,
          created_by: s.created_by || null,
          firm_name: s.firms?.name || 'Firm',
          dealer_name: s.dealers?.name || 'Dealer',
          dealer_phone: s.dealers?.phone || null,
          dealer_address: s.dealers?.address || null,
          dealer_city: s.dealers?.city || null,
          items: formattedItems,
          created_at: s.created_at,
          updated_at: s.updated_at,
        };
      }
    } catch (err) {
      console.warn('Error fetching simple sale bill by ID from Supabase:', err);
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
        hsn_code: prod?.hsn_code || item.hsn_code || '',
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
    dealer_address: dealer?.address || found.dealer_address || null,
    dealer_city: dealer?.city || found.dealer_city || null,
    items,
  };
}

/**
 * Update n_gst_subtotal & n_gst_total on sales_bills and n_gst_unit_price & n_gst_total_price on sales_bill_items.
 */
export async function updateSimpleSaleBillNGst(params: {
  saleId: string;
  n_gst_subtotal: number;
  n_gst_total: number;
  n_gst_old_balance?: number;
  n_gst_new_balance?: number;
  vehicle_number?: string | null;
  transporter_name?: string | null;
  items: Array<{
    id: string;
    n_gst_unit_price: number;
    n_gst_total_price: number;
  }>;
}): Promise<{ success: boolean; error: string | null }> {
  const {
    saleId,
    n_gst_subtotal,
    n_gst_total,
    n_gst_old_balance,
    n_gst_new_balance,
    vehicle_number,
    transporter_name,
    items,
  } = params;

  if (!saleId) {
    return { success: false, error: 'Sale ID is required.' };
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
      const updatePayload: Record<string, unknown> = {
        n_gst_subtotal: Number(n_gst_subtotal),
        n_gst_total: Number(n_gst_total),
        updated_at: nowIso,
      };
      if (n_gst_old_balance !== undefined) {
        updatePayload.n_gst_old_balance = Number(n_gst_old_balance);
      }
      if (n_gst_new_balance !== undefined) {
        updatePayload.n_gst_new_balance = Number(n_gst_new_balance);
      }
      if (vehicle_number !== undefined) {
        updatePayload.vehicle_number = vehicle_number?.trim() || null;
      }
      if (transporter_name !== undefined) {
        updatePayload.transporter_name = transporter_name?.trim() || null;
      }

      const { error: saleErr } = await supabase
        .from('sales_bills')
        .update(updatePayload)
        .eq('id', saleId);

      if (saleErr) {
        return { success: false, error: saleErr.message };
      }

      for (const item of items) {
        const { error: itemErr } = await supabase
          .from('sales_bill_items')
          .update({
            n_gst_unit_price: Number(item.n_gst_unit_price),
            n_gst_total_price: Number(item.n_gst_total_price),
            updated_at: nowIso,
          })
          .eq('id', item.id)
          .eq('sales_bill_id', saleId);

        if (itemErr) {
          return { success: false, error: itemErr.message };
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update N-GST sale bill details.';
      return { success: false, error: msg };
    }
  }

  // Update local caches
  const localSales = getLocalSalesBills();
  if (localSales.length > 0) {
    const updatedSales = localSales.map((s) =>
      s.id === saleId
        ? {
            ...s,
            n_gst_subtotal: Number(n_gst_subtotal),
            n_gst_total: Number(n_gst_total),
            ...(n_gst_old_balance !== undefined
              ? { n_gst_old_balance: Number(n_gst_old_balance) }
              : {}),
            ...(n_gst_new_balance !== undefined
              ? { n_gst_new_balance: Number(n_gst_new_balance) }
              : {}),
            ...(vehicle_number !== undefined
              ? { vehicle_number: vehicle_number?.trim() || null }
              : {}),
            ...(transporter_name !== undefined
              ? { transporter_name: transporter_name?.trim() || null }
              : {}),
            updated_at: nowIso,
          }
        : s
    );
    saveLocalSalesBills(updatedSales);
  }

  const localItems = getLocalSalesBillItems();
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
    saveLocalSalesBillItems(updatedItems);
  }

  return { success: true, error: null };
}
