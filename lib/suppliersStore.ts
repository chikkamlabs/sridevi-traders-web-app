import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms, Firm } from '@/lib/firmsStore';

export interface SupplierBalance {
  id?: string;
  firm_id: string;
  firm_name?: string;
  supplier_id: string;
  gst_balance: number;
  n_gst_balance: number;
  updated_at?: string;
}

export interface Supplier {
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
  total_balance?: number;
  balances?: SupplierBalance[];
  created_at?: string;
  updated_at?: string;
}

export interface SupplierInput {
  name: string;
  supplier_code?: string;
  phone?: string;
  email?: string;
  gst_number?: string;
  city?: string;
  address?: string;
  notes?: string;
  status?: boolean;
  opening_firm_id?: string;
  opening_balance?: number;
  opening_balances?: Array<{ firm_id: string; balance: number }>;
}

const LOCAL_SUPPLIERS_KEY = 'st_suppliers_cache';
const LOCAL_SUPPLIER_BALANCES_KEY = 'st_supplier_balances_cache';

export function generateSupplierCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `sup_${random4}`;
}

function getLocalSuppliers(): Supplier[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Supplier[];
  } catch {
    return [];
  }
}

function saveLocalSuppliers(suppliers: Supplier[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUPPLIERS_KEY, JSON.stringify(suppliers));
  } catch (err) {
    console.error('Failed to save suppliers locally:', err);
  }
}

function getLocalSupplierBalances(): SupplierBalance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_BALANCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SupplierBalance[];
  } catch {
    return [];
  }
}

function saveLocalSupplierBalances(balances: SupplierBalance[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUPPLIER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to save supplier balances locally:', err);
  }
}

/**
 * Fetch all suppliers with calculated total_balance from firm_supplier_balances.
 */
export async function getSuppliers(): Promise<Supplier[]> {
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
        console.warn('Error fetching suppliers from Supabase:', suppliersErr.message);
        return attachBalancesToSuppliers(getLocalSuppliers(), getLocalSupplierBalances(), firmMap);
      }

      if (suppliersData) {
        // Fetch all firm_supplier_balances
        const { data: balancesData } = await supabase
          .from('firm_supplier_balances')
          .select('*');

        const balances: SupplierBalance[] = (balancesData || []).map((b: any) => ({
          id: b.id,
          firm_id: b.firm_id,
          supplier_id: b.supplier_id,
          gst_balance: Number(b.gst_balance || 0),
          n_gst_balance: Number(b.n_gst_balance || 0),
          updated_at: b.updated_at,
          firm_name: firmMap.get(b.firm_id) || 'Unknown Firm',
        }));

        saveLocalSuppliers(suppliersData as Supplier[]);
        saveLocalSupplierBalances(balances);

        return attachBalancesToSuppliers(suppliersData as Supplier[], balances, firmMap);
      }
    } catch (err) {
      console.warn('Supabase getSuppliers exception:', err);
    }
  }

  return attachBalancesToSuppliers(getLocalSuppliers(), getLocalSupplierBalances(), firmMap);
}

function attachBalancesToSuppliers(
  suppliers: Supplier[],
  balances: SupplierBalance[],
  firmMap: Map<string, string>
): Supplier[] {
  return suppliers.map((s) => {
    const supplierBals = balances.filter((b) => b.supplier_id === s.id);
    const totalGst = supplierBals.reduce((sum, b) => sum + Number(b.gst_balance || 0), 0);
    return {
      ...s,
      total_balance: totalGst,
      balances: supplierBals.map((b) => ({
        ...b,
        firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
      })),
    };
  });
}

/**
 * Get total suppliers count.
 */
export async function getSuppliersCount(): Promise<number> {
  const suppliers = await getSuppliers();
  return suppliers.length;
}

/**
 * Get supplier by ID with detailed firm balances.
 */
export async function getSupplierById(id: string): Promise<Supplier | null> {
  const suppliers = await getSuppliers();
  return suppliers.find((s) => s.id === id) || null;
}

/**
 * Insert a new supplier into suppliers table and record opening balance in firm_supplier_balances.
 */
export async function addSupplier(
  supplierInput: SupplierInput
): Promise<{ data: Supplier | null; error: string | null }> {
  const cleanName = supplierInput.name.trim();
  if (!cleanName) {
    return { data: null, error: 'Supplier name is required.' };
  }

  const supplier_code = supplierInput.supplier_code?.trim() || generateSupplierCode();

  const payload = {
    name: cleanName,
    supplier_code,
    phone: supplierInput.phone?.trim() || null,
    email: supplierInput.email?.trim() || null,
    gst_number: supplierInput.gst_number?.trim().toUpperCase() || null,
    city: supplierInput.city?.trim() || null,
    address: supplierInput.address?.trim() || null,
    notes: supplierInput.notes?.trim() || null,
    status: supplierInput.status !== undefined ? supplierInput.status : true,
  };

  // Consolidate balances from opening_balances array or single opening_firm_id
  const openingBalancesToInsert: Array<{ firm_id: string; balance: number }> = [];
  if (supplierInput.opening_balances && supplierInput.opening_balances.length > 0) {
    supplierInput.opening_balances.forEach((ob) => {
      if (ob.firm_id) {
        openingBalancesToInsert.push({
          firm_id: ob.firm_id,
          balance: Number(ob.balance || 0),
        });
      }
    });
  } else if (supplierInput.opening_firm_id && Number(supplierInput.opening_balance || 0) > 0) {
    openingBalancesToInsert.push({
      firm_id: supplierInput.opening_firm_id,
      balance: Number(supplierInput.opening_balance),
    });
  }

  const totalCalculatedBalance = openingBalancesToInsert.reduce(
    (sum, b) => sum + b.balance,
    0
  );

  const firms = await getFirms();
  const firmMap = new Map<string, string>();
  firms.forEach((f) => firmMap.set(f.id, f.name));

  if (isSupabaseConfigured) {
    try {
      // 1. Insert supplier
      const { data: newSupplier, error: supplierErr } = await supabase
        .from('suppliers')
        .insert([payload])
        .select()
        .single();

      if (supplierErr || !newSupplier) {
        return { data: null, error: supplierErr?.message || 'Failed to insert supplier.' };
      }

      // 2. Insert opening balances into firm_supplier_balances
      const addedBalances: SupplierBalance[] = [];
      if (openingBalancesToInsert.length > 0) {
        const rowsToInsert = openingBalancesToInsert.map((ob) => ({
          firm_id: ob.firm_id,
          supplier_id: newSupplier.id,
          gst_balance: ob.balance,
          n_gst_balance: 0,
        }));

        const { data: balData, error: balErr } = await supabase
          .from('firm_supplier_balances')
          .insert(rowsToInsert)
          .select();

        if (!balErr && balData) {
          balData.forEach((b: any) => {
            addedBalances.push({
              id: b.id,
              firm_id: b.firm_id,
              supplier_id: b.supplier_id,
              gst_balance: Number(b.gst_balance),
              n_gst_balance: Number(b.n_gst_balance),
              firm_name: firmMap.get(b.firm_id) || 'Firm',
            });
          });

          const localBals = getLocalSupplierBalances();
          saveLocalSupplierBalances([...localBals, ...addedBalances]);
        }
      }

      const formattedSupplier: Supplier = {
        ...newSupplier,
        total_balance: totalCalculatedBalance,
        balances: addedBalances,
      };

      const localSuppliers = getLocalSuppliers();
      saveLocalSuppliers([formattedSupplier, ...localSuppliers]);

      return { data: formattedSupplier, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exception adding supplier.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newId = 'sup-' + Math.random().toString(36).substring(2, 9);
  const localBalances: SupplierBalance[] = openingBalancesToInsert.map((ob) => ({
    id: 'bal-' + Math.random().toString(36).substring(2, 9),
    firm_id: ob.firm_id,
    supplier_id: newId,
    gst_balance: ob.balance,
    n_gst_balance: 0,
    firm_name: firmMap.get(ob.firm_id) || 'Firm',
    updated_at: new Date().toISOString(),
  }));

  const localSupplier: Supplier = {
    id: newId,
    ...payload,
    total_balance: totalCalculatedBalance,
    balances: localBalances,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (localBalances.length > 0) {
    const currentBals = getLocalSupplierBalances();
    saveLocalSupplierBalances([...currentBals, ...localBalances]);
  }

  const currentSuppliers = getLocalSuppliers();
  saveLocalSuppliers([localSupplier, ...currentSuppliers]);

  return { data: localSupplier, error: null };
}

/**
 * Update an existing supplier. Does NOT allow changing balances (read-only view).
 */
export async function updateSupplier(
  id: string,
  updates: Partial<SupplierInput>
): Promise<{ data: Supplier | null; error: string | null }> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.supplier_code !== undefined) payload.supplier_code = updates.supplier_code.trim();
  if (updates.phone !== undefined) payload.phone = updates.phone.trim() || null;
  if (updates.email !== undefined) payload.email = updates.email.trim() || null;
  if (updates.gst_number !== undefined) payload.gst_number = updates.gst_number.trim().toUpperCase() || null;
  if (updates.city !== undefined) payload.city = updates.city.trim() || null;
  if (updates.address !== undefined) payload.address = updates.address.trim() || null;
  if (updates.notes !== undefined) payload.notes = updates.notes.trim() || null;
  if (updates.status !== undefined) payload.status = updates.status;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalSuppliers().map((s) => (s.id === id ? { ...s, ...data } : s));
        saveLocalSuppliers(local);
        return { data: data as Supplier, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update supplier.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const local = getLocalSuppliers();
  let found: Supplier | null = null;
  const updated = local.map((s) => {
    if (s.id === id) {
      found = {
        ...s,
        ...payload,
      };
      return found;
    }
    return s;
  });

  saveLocalSuppliers(updated);
  return { data: found, error: found ? null : 'Supplier not found.' };
}
