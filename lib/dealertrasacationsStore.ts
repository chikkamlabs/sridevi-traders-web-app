import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type DealerTransactionType =
  | 'sale'
  | 'receipt'
  | 'sales_return'
  | 'opening_balance'
  | 'adjustment';

export type PaymentMethod = 'cash' | 'upi' | 'cheque' | 'card' | 'neft' | 'NA';

export type TaxMode = 'gst' | 'n_gst' | 'mixed' | 'not_applicable';

export interface DealerTransaction {
  id: string;
  firm_id: string;
  dealer_id: string;
  transaction_code: string;
  transaction_type: DealerTransactionType;
  payment_method: PaymentMethod;
  amount: number;
  tax_mode: TaxMode;
  reference_type: string;
  reference_id?: string | null;
  notes?: string | null;
  transaction_date: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DealerTransactionInput {
  firm_id: string;
  dealer_id: string;
  transaction_code?: string;
  transaction_type: DealerTransactionType;
  payment_method: PaymentMethod;
  amount: number;
  tax_mode?: TaxMode;
  reference_type: string;
  reference_id?: string | null;
  notes?: string | null;
  transaction_date?: string;
}

const LOCAL_DEALER_TX_KEY = 'st_dealer_transactions_cache';
const LOCAL_DEALER_BALANCES_KEY = 'st_dealer_balances_cache';

export function generateDealerTransactionCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const suffix = Date.now().toString().slice(-4);
  return `dtx_${random4}_${suffix}`;
}

function getLocalDealerTransactions(): DealerTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALER_TX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DealerTransaction[];
  } catch {
    return [];
  }
}

function saveLocalDealerTransactions(list: DealerTransaction[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DEALER_TX_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save dealer transactions locally:', err);
  }
}

function updateLocalFirmDealerBalance(
  firmId: string,
  dealerId: string,
  amountToAdd: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_DEALER_BALANCES_KEY);
    const balances: any[] = raw ? JSON.parse(raw) : [];
    const idx = balances.findIndex(
      (b) => b.firm_id === firmId && b.dealer_id === dealerId
    );
    if (idx >= 0) {
      balances[idx] = {
        ...balances[idx],
        gst_balance: Number(balances[idx].gst_balance || 0) + amountToAdd,
        updated_at: new Date().toISOString(),
      };
    } else {
      balances.push({
        id: 'bal-' + Math.random().toString(36).substring(2, 9),
        firm_id: firmId,
        dealer_id: dealerId,
        gst_balance: amountToAdd,
        n_gst_balance: 0,
        updated_at: new Date().toISOString(),
      });
    }
    localStorage.setItem(LOCAL_DEALER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to update local dealer balance:', err);
  }
}

/**
 * Insert a record into dealer_transactions.
 */
export async function addDealerTransaction(
  input: DealerTransactionInput
): Promise<{ data: DealerTransaction | null; error: string | null }> {
  const amountNum = Number(input.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { data: null, error: 'Transaction amount must be greater than 0.' };
  }

  const transaction_code =
    input.transaction_code?.trim() || generateDealerTransactionCode();

  const payload = {
    firm_id: input.firm_id,
    dealer_id: input.dealer_id,
    transaction_code,
    transaction_type: input.transaction_type,
    payment_method: input.payment_method,
    amount: amountNum,
    tax_mode: input.tax_mode || 'gst',
    reference_type: input.reference_type,
    reference_id: input.reference_id || null,
    notes: input.notes?.trim() || null,
    transaction_date:
      input.transaction_date || new Date().toISOString().split('T')[0],
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('dealer_transactions')
        .insert([payload])
        .select()
        .single();

      if (error || !data) {
        return {
          data: null,
          error: error?.message || 'Failed to insert dealer transaction.',
        };
      }

      const formatted: DealerTransaction = {
        id: data.id,
        firm_id: data.firm_id,
        dealer_id: data.dealer_id,
        transaction_code: data.transaction_code,
        transaction_type: data.transaction_type,
        payment_method: data.payment_method,
        amount: Number(data.amount),
        tax_mode: data.tax_mode,
        reference_type: data.reference_type,
        reference_id: data.reference_id,
        notes: data.notes,
        transaction_date: data.transaction_date,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      saveLocalDealerTransactions([formatted, ...getLocalDealerTransactions()]);
      return { data: formatted, error: null };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Exception inserting dealer transaction.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const localTx: DealerTransaction = {
    id: 'dtx-' + Math.random().toString(36).substring(2, 10),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveLocalDealerTransactions([localTx, ...getLocalDealerTransactions()]);
  return { data: localTx, error: null };
}

/**
 * Update firm_dealer_balances.gst_balance = firm_dealer_balances.gst_balance + amount.
 * Inserts a balance row if one does not exist yet for the firm & dealer pair.
 */
export async function incrementFirmDealerGstBalance(
  firmId: string,
  dealerId: string,
  amount: number
): Promise<{ success: boolean; newBalance: number; error: string | null }> {
  const delta = Number(amount);
  if (isNaN(delta)) {
    return { success: false, newBalance: 0, error: 'Invalid balance amount.' };
  }

  if (isSupabaseConfigured) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('firm_dealer_balances')
        .select('id, gst_balance')
        .eq('firm_id', firmId)
        .eq('dealer_id', dealerId)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, newBalance: 0, error: fetchErr.message };
      }

      if (existing) {
        const updatedBalance = Number(existing.gst_balance || 0) + delta;
        const { error: updateErr } = await supabase
          .from('firm_dealer_balances')
          .update({
            gst_balance: updatedBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          return { success: false, newBalance: 0, error: updateErr.message };
        }

        updateLocalFirmDealerBalance(firmId, dealerId, delta);
        return { success: true, newBalance: updatedBalance, error: null };
      } else {
        const { error: insertErr } = await supabase
          .from('firm_dealer_balances')
          .insert([
            {
              firm_id: firmId,
              dealer_id: dealerId,
              gst_balance: delta,
              n_gst_balance: 0,
            },
          ]);

        if (insertErr) {
          return { success: false, newBalance: 0, error: insertErr.message };
        }

        updateLocalFirmDealerBalance(firmId, dealerId, delta);
        return { success: true, newBalance: delta, error: null };
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update firm dealer balance.';
      return { success: false, newBalance: 0, error: msg };
    }
  }

  // Local fallback
  updateLocalFirmDealerBalance(firmId, dealerId, delta);
  return { success: true, newBalance: delta, error: null };
}

/**
 * Record a sale dealer transaction (transaction_type = 'sale', payment_method = 'NA')
 * and increment firm_dealer_balances.gst_balance by the sale total amount.
 */
export async function recordSaleDealerTransaction(params: {
  firm_id: string;
  dealer_id: string;
  sales_bill_id: string;
  sale_number: string;
  invoice_number: string;
  amount: number;
  transaction_date: string;
  notes?: string | null;
}): Promise<{ data: DealerTransaction | null; error: string | null }> {
  const txResult = await addDealerTransaction({
    firm_id: params.firm_id,
    dealer_id: params.dealer_id,
    transaction_type: 'sale',
    payment_method: 'NA',
    amount: params.amount,
    tax_mode: 'gst',
    reference_type: 'sale',
    reference_id: params.sales_bill_id,
    transaction_date: params.transaction_date,
    notes:
      params.notes?.trim() ||
      `Sale ${params.sale_number} (Invoice: ${params.invoice_number})`,
  });

  if (txResult.error || !txResult.data) {
    return {
      data: null,
      error: txResult.error || 'Failed to record dealer transaction.',
    };
  }

  const balResult = await incrementFirmDealerGstBalance(
    params.firm_id,
    params.dealer_id,
    params.amount
  );

  if (!balResult.success) {
    return {
      data: txResult.data,
      error:
        balResult.error ||
        'Transaction saved, but failed to update dealer balance.',
    };
  }

  return { data: txResult.data, error: null };
}

export interface DealerFirmGstBalance {
  id: string;
  firm_id: string;
  firm_name: string;
  dealer_id: string;
  gst_balance: number;
  updated_at?: string;
}

export interface DealerTransactionRow extends DealerTransaction {
  firm_name?: string;
}

/**
 * Fetch all firm_dealer_balances rows for a given dealer_id (gst_balance only).
 */
export async function getDealerGstBalances(
  dealerId: string
): Promise<DealerFirmGstBalance[]> {
  if (!dealerId) return [];

  const { getFirms } = await import('@/lib/firmsStore');
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
          updated_at: b.updated_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching firm_dealer_balances from Supabase:', err);
    }
  }

  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALER_BALANCES_KEY);
    const balances: any[] = raw ? JSON.parse(raw) : [];
    return balances
      .filter((b) => b.dealer_id === dealerId)
      .map((b) => ({
        id: b.id || `${b.firm_id}_${b.dealer_id}`,
        firm_id: b.firm_id,
        firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
        dealer_id: b.dealer_id,
        gst_balance: Number(b.gst_balance || 0),
        updated_at: b.updated_at,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch all dealer_transactions rows for a given dealer_id where tax_mode = 'gst'.
 */
export async function getDealerGstTransactions(
  dealerId: string
): Promise<DealerTransactionRow[]> {
  if (!dealerId) return [];

  const { getFirms } = await import('@/lib/firmsStore');
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
        .eq('tax_mode', 'gst')
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
      console.warn('Error fetching GST dealer_transactions from Supabase:', err);
    }
  }

  return getLocalDealerTransactions()
    .filter((tx) => tx.dealer_id === dealerId && tx.tax_mode === 'gst')
    .sort((a, b) =>
      String(b.transaction_date || '').localeCompare(String(a.transaction_date || ''))
    )
    .map((tx) => ({
      ...tx,
      firm_name: firmMap.get(tx.firm_id) || 'Firm',
      amount: Number(tx.amount || 0),
    }));
}

/**
 * Insert a record into dealer_transactions with tax_mode = 'gst'
 * and update firm_dealer_balances.gst_balance = firm_dealer_balances.gst_balance - amount.
 */
export async function addDealerGstTransactionAndUpdateBalance(
  input: Omit<DealerTransactionInput, 'tax_mode'>
): Promise<{ data: DealerTransaction | null; error: string | null }> {
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

  const txResult = await addDealerTransaction({
    ...input,
    amount: amountNum,
    tax_mode: 'gst',
    reference_type: input.reference_type?.trim() || 'manual',
    reference_id: input.reference_id?.trim() || null,
  });

  if (txResult.error || !txResult.data) {
    return {
      data: null,
      error: txResult.error || 'Failed to insert dealer transaction.',
    };
  }

  const balResult = await incrementFirmDealerGstBalance(
    input.firm_id,
    input.dealer_id,
    -amountNum
  );

  if (!balResult.success) {
    return {
      data: txResult.data,
      error:
        balResult.error ||
        'Transaction saved, but failed to update dealer GST balance.',
    };
  }

  return { data: txResult.data, error: null };
}
