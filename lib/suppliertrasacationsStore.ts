import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type SupplierTransactionType =
  | 'purchase'
  | 'payment'
  | 'purchase_return'
  | 'opening_balance'
  | 'adjustment';

export type PaymentMethod = 'cash' | 'upi' | 'cheque' | 'card' | 'neft' | 'NA';

export type TaxMode = 'gst' | 'n_gst' | 'mixed' | 'not_applicable';

export interface SupplierTransaction {
  id: string;
  firm_id: string;
  supplier_id: string;
  transaction_code: string;
  transaction_type: SupplierTransactionType;
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

export interface SupplierTransactionInput {
  firm_id: string;
  supplier_id: string;
  transaction_code?: string;
  transaction_type: SupplierTransactionType;
  payment_method: PaymentMethod;
  amount: number;
  tax_mode?: TaxMode;
  reference_type: string;
  reference_id?: string | null;
  notes?: string | null;
  transaction_date?: string;
}

const LOCAL_SUPPLIER_TX_KEY = 'st_supplier_transactions_cache';
const LOCAL_SUPPLIER_BALANCES_KEY = 'st_supplier_balances_cache';

export function generateSupplierTransactionCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const suffix = Date.now().toString().slice(-4);
  return `stx_${random4}_${suffix}`;
}

function getLocalTransactions(): SupplierTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_TX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SupplierTransaction[];
  } catch {
    return [];
  }
}

function saveLocalTransactions(list: SupplierTransaction[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUPPLIER_TX_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save supplier transactions locally:', err);
  }
}

function updateLocalFirmSupplierBalance(
  firmId: string,
  supplierId: string,
  amountToAdd: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_BALANCES_KEY);
    const balances: any[] = raw ? JSON.parse(raw) : [];
    const idx = balances.findIndex(
      (b) => b.firm_id === firmId && b.supplier_id === supplierId
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
        supplier_id: supplierId,
        gst_balance: amountToAdd,
        n_gst_balance: 0,
        updated_at: new Date().toISOString(),
      });
    }
    localStorage.setItem(LOCAL_SUPPLIER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to update local supplier balance:', err);
  }
}

/**
 * Insert a record into supplier_transactions.
 */
export async function addSupplierTransaction(
  input: SupplierTransactionInput
): Promise<{ data: SupplierTransaction | null; error: string | null }> {
  const amountNum = Number(input.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { data: null, error: 'Transaction amount must be greater than 0.' };
  }

  const transaction_code =
    input.transaction_code?.trim() || generateSupplierTransactionCode();

  const payload = {
    firm_id: input.firm_id,
    supplier_id: input.supplier_id,
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
        .from('supplier_transactions')
        .insert([payload])
        .select()
        .single();

      if (error || !data) {
        return {
          data: null,
          error: error?.message || 'Failed to insert supplier transaction.',
        };
      }

      const formatted: SupplierTransaction = {
        id: data.id,
        firm_id: data.firm_id,
        supplier_id: data.supplier_id,
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

      saveLocalTransactions([formatted, ...getLocalTransactions()]);
      return { data: formatted, error: null };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Exception inserting supplier transaction.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const localTx: SupplierTransaction = {
    id: 'stx-' + Math.random().toString(36).substring(2, 10),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveLocalTransactions([localTx, ...getLocalTransactions()]);
  return { data: localTx, error: null };
}

/**
 * Update firm_supplier_balances.gst_balance = firm_supplier_balances.gst_balance + amount.
 * Inserts a balance row if one does not exist yet for the firm & supplier pair.
 */
export async function incrementFirmSupplierGstBalance(
  firmId: string,
  supplierId: string,
  amount: number
): Promise<{ success: boolean; newBalance: number; error: string | null }> {
  const delta = Number(amount);
  if (isNaN(delta)) {
    return { success: false, newBalance: 0, error: 'Invalid balance amount.' };
  }

  if (isSupabaseConfigured) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('firm_supplier_balances')
        .select('id, gst_balance')
        .eq('firm_id', firmId)
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, newBalance: 0, error: fetchErr.message };
      }

      if (existing) {
        const updatedBalance = Number(existing.gst_balance || 0) + delta;
        const { error: updateErr } = await supabase
          .from('firm_supplier_balances')
          .update({
            gst_balance: updatedBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          return { success: false, newBalance: 0, error: updateErr.message };
        }

        updateLocalFirmSupplierBalance(firmId, supplierId, delta);
        return { success: true, newBalance: updatedBalance, error: null };
      } else {
        const { error: insertErr } = await supabase
          .from('firm_supplier_balances')
          .insert([
            {
              firm_id: firmId,
              supplier_id: supplierId,
              gst_balance: delta,
              n_gst_balance: 0,
            },
          ]);

        if (insertErr) {
          return { success: false, newBalance: 0, error: insertErr.message };
        }

        updateLocalFirmSupplierBalance(firmId, supplierId, delta);
        return { success: true, newBalance: delta, error: null };
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update firm supplier balance.';
      return { success: false, newBalance: 0, error: msg };
    }
  }

  // Local fallback
  updateLocalFirmSupplierBalance(firmId, supplierId, delta);
  return { success: true, newBalance: delta, error: null };
}

/**
 * Record a purchase supplier transaction (transaction_type = 'purchase', payment_method = 'NA')
 * and increment firm_supplier_balances.gst_balance by the purchase total amount.
 */
export async function recordPurchaseSupplierTransaction(params: {
  firm_id: string;
  supplier_id: string;
  purchase_id: string;
  purchase_number: string;
  invoice_number: string;
  amount: number;
  transaction_date: string;
  notes?: string | null;
}): Promise<{ data: SupplierTransaction | null; error: string | null }> {
  const txResult = await addSupplierTransaction({
    firm_id: params.firm_id,
    supplier_id: params.supplier_id,
    transaction_type: 'purchase',
    payment_method: 'NA',
    amount: params.amount,
    tax_mode: 'gst',
    reference_type: 'purchase',
    reference_id: params.purchase_id,
    transaction_date: params.transaction_date,
    notes:
      params.notes?.trim() ||
      `Purchase ${params.purchase_number} (Invoice: ${params.invoice_number})`,
  });

  if (txResult.error || !txResult.data) {
    return { data: null, error: txResult.error || 'Failed to record supplier transaction.' };
  }

  const balResult = await incrementFirmSupplierGstBalance(
    params.firm_id,
    params.supplier_id,
    params.amount
  );

  if (!balResult.success) {
    return {
      data: txResult.data,
      error: balResult.error || 'Transaction saved, but failed to update supplier balance.',
    };
  }

  return { data: txResult.data, error: null };
}

export interface SupplierFirmGstBalance {
  id: string;
  firm_id: string;
  firm_name: string;
  supplier_id: string;
  gst_balance: number;
  updated_at?: string;
}

export interface SupplierTransactionRow extends SupplierTransaction {
  firm_name?: string;
}

/**
 * Fetch all firm_supplier_balances rows for a given supplier_id (gst_balance only).
 */
export async function getSupplierGstBalances(
  supplierId: string
): Promise<SupplierFirmGstBalance[]> {
  if (!supplierId) return [];

  const { getFirms } = await import('@/lib/firmsStore');
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
          updated_at: b.updated_at,
        }));
      }
    } catch (err) {
      console.warn('Error fetching firm_supplier_balances from Supabase:', err);
    }
  }

  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIER_BALANCES_KEY);
    const balances: any[] = raw ? JSON.parse(raw) : [];
    return balances
      .filter((b) => b.supplier_id === supplierId)
      .map((b) => ({
        id: b.id || `${b.firm_id}_${b.supplier_id}`,
        firm_id: b.firm_id,
        firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
        supplier_id: b.supplier_id,
        gst_balance: Number(b.gst_balance || 0),
        updated_at: b.updated_at,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetch all supplier_transactions rows for a given supplier_id where tax_mode = 'gst'.
 */
export async function getSupplierGstTransactions(
  supplierId: string
): Promise<SupplierTransactionRow[]> {
  if (!supplierId) return [];

  const { getFirms } = await import('@/lib/firmsStore');
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
        .eq('tax_mode', 'gst')
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
      console.warn('Error fetching GST supplier_transactions from Supabase:', err);
    }
  }

  return getLocalTransactions()
    .filter((tx) => tx.supplier_id === supplierId && tx.tax_mode === 'gst')
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
 * Insert a record into supplier_transactions with tax_mode = 'gst'
 * and update firm_supplier_balances.gst_balance = firm_supplier_balances.gst_balance - amount.
 */
export async function addSupplierGstTransactionAndUpdateBalance(
  input: Omit<SupplierTransactionInput, 'tax_mode'>
): Promise<{ data: SupplierTransaction | null; error: string | null }> {
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

  const txResult = await addSupplierTransaction({
    ...input,
    amount: amountNum,
    tax_mode: 'gst',
    reference_type: input.reference_type?.trim() || 'manual',
    reference_id: input.reference_id?.trim() || null,
  });

  if (txResult.error || !txResult.data) {
    return {
      data: null,
      error: txResult.error || 'Failed to insert supplier transaction.',
    };
  }

  const balResult = await incrementFirmSupplierGstBalance(
    input.firm_id,
    input.supplier_id,
    -amountNum
  );

  if (!balResult.success) {
    return {
      data: txResult.data,
      error:
        balResult.error ||
        'Transaction saved, but failed to update supplier GST balance.',
    };
  }

  return { data: txResult.data, error: null };
}
