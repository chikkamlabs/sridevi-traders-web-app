import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';
import type { SimpleDealerBalance } from '@/lib/simple/ndealersStore';
import type {
  DealerTransactionType,
  PaymentMethod,
  TaxMode,
} from '@/lib/dealertrasacationsStore';

export interface SimpleDealerTransactionRow {
  id: string;
  firm_id: string;
  firm_name?: string;
  dealer_id: string;
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

export interface AddSimpleDealerTransactionInput {
  firm_id: string;
  dealer_id: string;
  transaction_code?: string;
  transaction_type: DealerTransactionType;
  payment_method: PaymentMethod;
  amount: number;
  tax_mode: TaxMode;
  reference_type: string;
  reference_id?: string | null;
  notes?: string | null;
  transaction_date: string;
}

const LOCAL_DEALER_BALANCES_KEY = 'st_dealer_balances_cache';
const LOCAL_DEALER_TX_KEY = 'st_dealer_transactions_cache';

export function generateSimpleDealerTxCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const suffix = Date.now().toString().slice(-4);
  return `dtx_${random4}_${suffix}`;
}

function getLocalBalances(): SimpleDealerBalance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALER_BALANCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleDealerBalance[];
  } catch {
    return [];
  }
}

function saveLocalBalances(balances: SimpleDealerBalance[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DEALER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to save dealer balances locally:', err);
  }
}

function getLocalTransactions(): SimpleDealerTransactionRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALER_TX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleDealerTransactionRow[];
  } catch {
    return [];
  }
}

function saveLocalTransactions(list: SimpleDealerTransactionRow[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DEALER_TX_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save dealer transactions locally:', err);
  }
}

function updateLocalDealerBalanceByTaxMode(
  firmId: string,
  dealerId: string,
  taxMode: TaxMode,
  amount: number
): void {
  if (taxMode !== 'gst' && taxMode !== 'n_gst') return;
  const balances = getLocalBalances();
  const idx = balances.findIndex(
    (b) => b.firm_id === firmId && b.dealer_id === dealerId
  );

  if (idx >= 0) {
    const current = balances[idx];
    balances[idx] = {
      ...current,
      gst_balance:
        taxMode === 'gst'
          ? Number(current.gst_balance || 0) + amount
          : Number(current.gst_balance || 0),
      n_gst_balance:
        taxMode === 'n_gst'
          ? Number(current.n_gst_balance || 0) + amount
          : Number(current.n_gst_balance || 0),
      updated_at: new Date().toISOString(),
    };
  } else {
    balances.push({
      id: 'bal-' + Math.random().toString(36).substring(2, 9),
      firm_id: firmId,
      dealer_id: dealerId,
      gst_balance: taxMode === 'gst' ? amount : 0,
      n_gst_balance: taxMode === 'n_gst' ? amount : 0,
      updated_at: new Date().toISOString(),
    });
  }
  saveLocalBalances(balances);
}

/**
 * Fetch all firm_dealer_balances rows for a given dealer_id.
 */
export async function getSimpleDealerBalances(
  dealerId: string
): Promise<SimpleDealerBalance[]> {
  if (!dealerId) return [];

  const firms = await getFirms();
  const firmMap = new Map<string, string>();
  firms.forEach((f) => firmMap.set(f.id, f.name));

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('firm_dealer_balances')
        .select(`
          id,
          firm_id,
          dealer_id,
          gst_balance,
          n_gst_balance,
          updated_at,
          firms ( name )
        `)
        .eq('dealer_id', dealerId);

      if (!error && data) {
        return data.map((b: any) => ({
          id: b.id,
          firm_id: b.firm_id,
          firm_name: b.firms?.name || firmMap.get(b.firm_id) || 'Firm',
          dealer_id: b.dealer_id,
          gst_balance: Number(b.gst_balance || 0),
          n_gst_balance: Number(b.n_gst_balance || 0),
          updated_at: b.updated_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching firm_dealer_balances from Supabase:', err);
    }
  }

  return getLocalBalances()
    .filter((b) => b.dealer_id === dealerId)
    .map((b) => ({
      ...b,
      firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
      gst_balance: Number(b.gst_balance || 0),
      n_gst_balance: Number(b.n_gst_balance || 0),
    }));
}

/**
 * Fetch all dealer_transactions rows for a given dealer_id.
 */
export async function getSimpleDealerTransactions(
  dealerId: string
): Promise<SimpleDealerTransactionRow[]> {
  if (!dealerId) return [];

  const firms = await getFirms();
  const firmMap = new Map<string, string>();
  firms.forEach((f) => firmMap.set(f.id, f.name));

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('dealer_transactions')
        .select(`
          id,
          firm_id,
          dealer_id,
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
        .eq('dealer_id', dealerId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((tx: any) => ({
          id: tx.id,
          firm_id: tx.firm_id,
          firm_name: tx.firms?.name || firmMap.get(tx.firm_id) || 'Firm',
          dealer_id: tx.dealer_id,
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
      console.warn('Error fetching dealer_transactions from Supabase:', err);
    }
  }

  return getLocalTransactions()
    .filter((tx) => tx.dealer_id === dealerId)
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
 * Insert a record into dealer_transactions and update firm_dealer_balances.gst_balance (if tax_mode = gst)
 * or firm_dealer_balances.n_gst_balance (if tax_mode = n_gst) by adding the entered amount.
 */
export async function addSimpleDealerTransactionAndUpdateBalance(
  input: AddSimpleDealerTransactionInput
): Promise<{ data: SimpleDealerTransactionRow | null; error: string | null }> {
  if (!input.firm_id) {
    return { data: null, error: 'Please select a firm.' };
  }
  if (!input.dealer_id) {
    return { data: null, error: 'Dealer ID is required.' };
  }

  const amountNum = Number(input.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { data: null, error: 'Amount must be greater than 0.' };
  }

  const transaction_code =
    input.transaction_code?.trim() || generateSimpleDealerTxCode();
  const reference_type = input.reference_type?.trim() || 'manual';
  const reference_id = input.reference_id?.trim() || null;

  const payload = {
    firm_id: input.firm_id,
    dealer_id: input.dealer_id,
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
      // 1. Insert into dealer_transactions
      const { data: txData, error: txErr } = await supabase
        .from('dealer_transactions')
        .insert([payload])
        .select()
        .single();

      if (txErr || !txData) {
        return {
          data: null,
          error: txErr?.message || 'Failed to insert dealer transaction.',
        };
      }

      // 2. Update firm_dealer_balances.gst_balance (if tax_mode = gst) or n_gst_balance (if tax_mode = n_gst)
      if (input.tax_mode === 'gst' || input.tax_mode === 'n_gst') {
        const { data: existing, error: fetchErr } = await supabase
          .from('firm_dealer_balances')
          .select('id, gst_balance, n_gst_balance')
          .eq('firm_id', input.firm_id)
          .eq('dealer_id', input.dealer_id)
          .maybeSingle();

        if (fetchErr) {
          return { data: null, error: fetchErr.message };
        }

        const nowIso = new Date().toISOString();
        if (existing) {
          const updateFields =
            input.tax_mode === 'gst'
              ? {
                  gst_balance: Number(existing.gst_balance || 0) + amountNum,
                  updated_at: nowIso,
                }
              : {
                  n_gst_balance: Number(existing.n_gst_balance || 0) + amountNum,
                  updated_at: nowIso,
                };

          const { error: updateErr } = await supabase
            .from('firm_dealer_balances')
            .update(updateFields)
            .eq('id', existing.id);

          if (updateErr) {
            return { data: null, error: updateErr.message };
          }
        } else {
          const { error: insertErr } = await supabase
            .from('firm_dealer_balances')
            .insert([
              {
                firm_id: input.firm_id,
                dealer_id: input.dealer_id,
                gst_balance: input.tax_mode === 'gst' ? amountNum : 0,
                n_gst_balance: input.tax_mode === 'n_gst' ? amountNum : 0,
              },
            ]);

          if (insertErr) {
            return { data: null, error: insertErr.message };
          }
        }
      }

      const formatted: SimpleDealerTransactionRow = {
        id: txData.id,
        firm_id: txData.firm_id,
        dealer_id: txData.dealer_id,
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
      updateLocalDealerBalanceByTaxMode(
        input.firm_id,
        input.dealer_id,
        input.tax_mode,
        amountNum
      );

      return { data: formatted, error: null };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to save dealer transaction.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const localTx: SimpleDealerTransactionRow = {
    id: 'dtx-' + Math.random().toString(36).substring(2, 10),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveLocalTransactions([localTx, ...getLocalTransactions()]);
  updateLocalDealerBalanceByTaxMode(
    input.firm_id,
    input.dealer_id,
    input.tax_mode,
    amountNum
  );

  return { data: localTx, error: null };
}
