import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';

export interface SimpleSupplierBalance {
  id?: string;
  firm_id: string;
  firm_name?: string;
  supplier_id: string;
  gst_balance: number;
  n_gst_balance: number;
  updated_at?: string;
}

export interface SimpleSupplier {
  id: string;
  name: string;
  supplier_code: string;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  status: boolean;
  total_balance: number;
  balances?: SimpleSupplierBalance[];
  created_at?: string;
  updated_at?: string;
}

const LOCAL_SUPPLIERS_KEY = 'st_suppliers_cache';
const LOCAL_SUPPLIER_BALANCES_KEY = 'st_supplier_balances_cache';

function getLocalSuppliers(): SimpleSupplier[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleSupplier[];
  } catch {
    return [];
  }
}

function getLocalSupplierBalances(): SimpleSupplierBalance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_BALANCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleSupplierBalance[];
  } catch {
    return [];
  }
}

function attachNGstBalancesToSuppliers(
  suppliers: any[],
  balances: SimpleSupplierBalance[],
  firmMap: Map<string, string>
): SimpleSupplier[] {
  return suppliers.map((s) => {
    const supplierBals = balances.filter((b) => b.supplier_id === s.id);
    const totalNGst = supplierBals.reduce(
      (sum, b) => sum + Number(b.n_gst_balance || 0),
      0
    );
    return {
      ...s,
      total_balance: totalNGst,
      balances: supplierBals.map((b) => ({
        ...b,
        firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
      })),
    };
  });
}

/**
 * Fetch all suppliers with total_balance calculated as the sum of all n_gst_balance values in firm_supplier_balances.
 */
export async function getSimpleSuppliers(): Promise<SimpleSupplier[]> {
  const firms = await getFirms();
  const firmMap = new Map<string, string>();
  firms.forEach((f) => firmMap.set(f.id, f.name));

  if (isSupabaseConfigured) {
    try {
      const { data: suppliersData, error: suppliersErr } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (suppliersErr) {
        console.warn('Error fetching simple suppliers from Supabase:', suppliersErr.message);
        return attachNGstBalancesToSuppliers(
          getLocalSuppliers(),
          getLocalSupplierBalances(),
          firmMap
        );
      }

      if (suppliersData) {
        const { data: balancesData } = await supabase
          .from('firm_supplier_balances')
          .select('*');

        const balances: SimpleSupplierBalance[] = (balancesData || []).map((b: any) => ({
          id: b.id,
          firm_id: b.firm_id,
          supplier_id: b.supplier_id,
          gst_balance: Number(b.gst_balance || 0),
          n_gst_balance: Number(b.n_gst_balance || 0),
          updated_at: b.updated_at,
          firm_name: firmMap.get(b.firm_id) || 'Unknown Firm',
        }));

        return attachNGstBalancesToSuppliers(suppliersData, balances, firmMap);
      }
    } catch (err) {
      console.warn('Supabase getSimpleSuppliers exception:', err);
    }
  }

  return attachNGstBalancesToSuppliers(
    getLocalSuppliers(),
    getLocalSupplierBalances(),
    firmMap
  );
}

/**
 * Fetch a single supplier by ID with N-GST total_balance and firm_supplier_balances.
 */
export async function getSimpleSupplierById(
  id: string
): Promise<SimpleSupplier | null> {
  if (!id) return null;
  const suppliers = await getSimpleSuppliers();
  return suppliers.find((s) => s.id === id) || null;
}
