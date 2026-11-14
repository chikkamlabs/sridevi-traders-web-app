import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';
import type { SimpleSupplierBalance } from '@/lib/simple/nsuppliersStore';
import type {
  SupplierTransactionType,
  PaymentMethod,
  TaxMode,
} from '@/lib/suppliertrasacationsStore';

export interface SimpleSupplierTransactionRow {
  id: string;
  firm_id: string;
  firm_name?: string;
  supplier_id: string;
  transaction_code: string;
  transaction_type: string;
  payment_method: string;
  amount: number;
  tax_mode: string;
  reference_type: string;
  reference_id?: string | null;
  notes?: string | null;
  transaction_date: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AddSimpleSupplierTransactionInput {
  firm_id: string;
  supplier_id: string;
  transaction_code?: string;
  transaction_type: SupplierTransactionType;
  payment_method: PaymentMethod;
  amount: number;
  tax_mode: TaxMode;
  reference_type: string;
  reference_id?: string | null;
  notes?: string | null;
  transaction_date: string;
}

const LOCAL_SUPPLIER_BALANCES_KEY = 'st_supplier_balances_cache';
const LOCAL_SUPPLIER_TX_KEY = 'st_supplier_transactions_cache';

export function generateSimpleSupplierTxCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const suffix = Date.now().toString().slice(-4);
  return `stx_${random4}_${suffix}`;
}

function getLocalBalances(): SimpleSupplierBalance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_BALANCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleSupplierBalance[];
  } catch {
    return [];
  }
}

function saveLocalBalances(balances: SimpleSupplierBalance[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUPPLIER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to save supplier balances locally:', err);
  }
}

function getLocalTransactions(): SimpleSupplierTransactionRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_TX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleSupplierTransactionRow[];
  } catch {
    return [];
  }
}

function saveLocalTransactions(list: SimpleSupplierTransactionRow[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUPPLIER_TX_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save supplier transactions locally:', err);
  }
}

function updateLocalSupplierBalanceByTaxMode(
  firmId: string,
  supplierId: string,
  taxMode: TaxMode,
  amount: number
): void {
  if (taxMode !== 'gst' && taxMode !== 'n_gst') return;
  const balances = getLocalBalances();
  const idx = balances.findIndex(
    (b) => b.firm_id === firmId && b.supplier_id === supplierId
  );

  if (idx >= 0) {
    const current = balances[idx];
    balances[idx] = {
      ...current,
      gst_balance:
        taxMode === 'gst'
          ? Number(current.gst_balance || 0) - amount
          : Number(current.gst_balance || 0),
      n_gst_balance:
        taxMode === 'n_gst'
          ? Number(current.n_gst_balance || 0) - amount
          : Number(current.n_gst_balance || 0),
      updated_at: new Date().toISOString(),
    };
  } else {
    balances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      firm_id: firmId,
      supplier_id: supplierId,
      gst_balance: taxMode === 'gst' ? -amount : 0,
      n_gst_balance: taxMode === 'n_gst' ? -amount : 0,
      updated_at: new Date().toISOString(),
    });
  }
  saveLocalBalances(balances);
}

/**
 * Fetch all firm_supplier_balances rows for a given supplier_id.
 */
export async function getSimpleSupplierBalances(
  supplierId: string
): Promise<SimpleSupplierBalance[]> {
  if (!supplierId) return [];

  const firms = await getFirms();
  const firmMap = new Map<string, string>();
  firms.forEach((f) => firmMap.set(f.id, f.name));

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('firm_supplier_balances')
        .select(`
          id,
          firm_id,
          supplier_id,
          gst_balance,
          n_gst_balance,
          updated_at,
          firms ( name )
        `)
        .eq('supplier_id', supplierId);

      if (!error && data) {
        return data.map((b: any) => ({
          id: b.id,
          firm_id: b.firm_id,
          firm_name: b.firms?.name || firmMap.get(b.firm_id) || 'Firm',
          supplier_id: b.supplier_id,
          gst_balance: Number(b.gst_balance || 0),
          n_gst_balance: Number(b.n_gst_balance || 0),
          updated_at: b.updated_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching firm_supplier_balances from Supabase:', err);
    }
  }

  return getLocalBalances()
    .filter((b) => b.supplier_id === supplierId)
    .map((b) => ({
      ...b,
      firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
      gst_balance: Number(b.gst_balance || 0),
      n_gst_balance: Number(b.n_gst_balance || 0),
    }));
}

/**
 * Fetch all supplier_transactions rows for a given supplier_id.
 */
export async function getSimpleSupplierTransactions(
  supplierId: string
): Promise<SimpleSupplierTransactionRow[]> {
  if (!supplierId) return [];

  const firms = await getFirms();
  const firmMap = new Map<string, string>();
  firms.forEach((f) => firmMap.set(f.id, f.name));

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('supplier_transactions')
        .select(`
          id,
          firm_id,
          supplier_id,
          transaction_code,
          transaction_type,
          payment_method,
          amount,
          tax_mode,
          reference_type,
          reference_id,
          notes,
          transaction_date,
          created_by,
          created_at,
          updated_at,
          firms ( name )
        `)
        .eq('supplier_id', supplierId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((tx: any) => ({
          id: tx.id,
          firm_id: tx.firm_id,
          firm_name: tx.firms?.name || firmMap.get(tx.firm_id) || 'Firm',
          supplier_id: tx.supplier_id,
          transaction_code: tx.transaction_code,
          transaction_type: tx.transaction_type,
          payment_method: tx.payment_method,
          amount: Number(tx.amount || 0),
          tax_mode: tx.tax_mode,
          reference_type: tx.reference_type,
          reference_id: tx.reference_id || null,
          notes: tx.notes || null,
          transaction_date: tx.transaction_date,
          created_by: tx.created_by || null,
          created_at: tx.created_at,
          updated_at: tx.updated_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching supplier_transactions from Supabase:', err);
    }
  }

  return getLocalTransactions()
    .filter((tx) => tx.supplier_id === supplierId)
    .sort((a, b) =>
      String(b.transaction_date || '').localeCompare(String(a.transaction_date || ''))
    )
    .map((tx) => ({
      ...tx,
      firm_name: firmMap.get(tx.firm_id) || tx.firm_name || 'Firm',
      amount: Number(tx.amount || 0),
    }));
}

/**
 * Insert a record into supplier_transactions and update firm_supplier_balances.gst_balance (if tax_mode = gst)
 * or firm_supplier_balances.n_gst_balance (if tax_mode = n_gst) by subtracting the entered amount.
 */
export async function addSimpleSupplierTransactionAndUpdateBalance(
  input: AddSimpleSupplierTransactionInput
): Promise<{ data: SimpleSupplierTransactionRow | null; error: string | null }> {
  if (!input.firm_id) {
    return { data: null, error: 'Please select a firm.' };
  }
  if (!input.supplier_id) {
    return { data: null, error: 'Supplier ID is required.' };
  }

  const amountNum = Number(input.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { data: null, error: 'Amount must be greater than 0.' };
  }

  const transaction_code =
    input.transaction_code?.trim() || generateSimpleSupplierTxCode();
  const reference_type = input.reference_type?.trim() || 'manual';
  const reference_id = input.reference_id?.trim() || null;

  const payload = {
    firm_id: input.firm_id,
    supplier_id: input.supplier_id,
    transaction_code,
    transaction_type: input.transaction_type,
    payment_method: input.payment_method,
    amount: amountNum,
    tax_mode: input.tax_mode,
    reference_type,
    reference_id,
    notes: input.notes?.trim() || null,
    transaction_date:
      input.transaction_date || new Date().toISOString().split('T')[0],
  };

  if (isSupabaseConfigured) {
    try {
      // 1. Insert into supplier_transactions
      const { data: txData, error: txErr } = await supabase
        .from('supplier_transactions')
        .insert([payload])
        .select()
        .single();

      if (txErr || !txData) {
        return {
          data: null,
          error: txErr?.message || 'Failed to insert supplier transaction.',
        };
      }

      // 2. Update firm_supplier_balances.gst_balance (if tax_mode = gst) or n_gst_balance (if tax_mode = n_gst)
      if (input.tax_mode === 'gst' || input.tax_mode === 'n_gst') {
        const { data: existing, error: fetchErr } = await supabase
          .from('firm_supplier_balances')
          .select('id, gst_balance, n_gst_balance')
          .eq('firm_id', input.firm_id)
          .eq('supplier_id', input.supplier_id)
          .maybeSingle();

        if (fetchErr) {
          return { data: null, error: fetchErr.message };
        }

        const nowIso = new Date().toISOString();
        if (existing) {
          const updateFields =
            input.tax_mode === 'gst'
              ? {
                  gst_balance: Number(existing.gst_balance || 0) - amountNum,
                  updated_at: nowIso,
                }
              : {
                  n_gst_balance: Number(existing.n_gst_balance || 0) - amountNum,
                  updated_at: nowIso,
                };

          const { error: updateErr } = await supabase
            .from('firm_supplier_balances')
            .update(updateFields)
            .eq('id', existing.id);

          if (updateErr) {
            return { data: null, error: updateErr.message };
          }
        } else {
          const { error: insertErr } = await supabase
            .from('firm_supplier_balances')
            .insert([
              {
                firm_id: input.firm_id,
                supplier_id: input.supplier_id,
                gst_balance: input.tax_mode === 'gst' ? -amountNum : 0,
                n_gst_balance: input.tax_mode === 'n_gst' ? -amountNum : 0,
              },
            ]);

          if (insertErr) {
            return { data: null, error: insertErr.message };
          }
        }
      }

      const formatted: SimpleSupplierTransactionRow = {
        id: txData.id,
        firm_id: txData.firm_id,
        supplier_id: txData.supplier_id,
        transaction_code: txData.transaction_code,
        transaction_type: txData.transaction_type,
        payment_method: txData.payment_method,
        amount: Number(txData.amount),
        tax_mode: txData.tax_mode,
        reference_type: txData.reference_type,
        reference_id: txData.reference_id || null,
        notes: txData.notes || null,
        transaction_date: txData.transaction_date,
        created_by: txData.created_by || null,
        created_at: txData.created_at,
        updated_at: txData.updated_at,
      };

      saveLocalTransactions([formatted, ...getLocalTransactions()]);
      updateLocalSupplierBalanceByTaxMode(
        input.firm_id,
        input.supplier_id,
        input.tax_mode,
        amountNum
      );

      return { data: formatted, error: null };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to save supplier transaction.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const localTx: SimpleSupplierTransactionRow = {
    id: 'stx-' + Math.random().toString(36).substring(2, 10),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveLocalTransactions([localTx, ...getLocalTransactions()]);
  updateLocalSupplierBalanceByTaxMode(
    input.firm_id,
    input.supplier_id,
    input.tax_mode,
    amountNum
  );

  return { data: localTx, error: null };
}
