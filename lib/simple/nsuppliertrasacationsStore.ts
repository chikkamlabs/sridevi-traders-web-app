import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  SupplierTransaction,
  SupplierTransactionInput,
} from '@/lib/suppliertrasacationsStore';

const LOCAL_SUPPLIER_TX_KEY = 'st_supplier_transactions_cache';
const LOCAL_SUPPLIER_BALANCES_KEY = 'st_supplier_balances_cache';

export function generateSimpleSupplierTransactionCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const suffix = Date.now().toString().slice(-4);
  return `nstx_${random4}_${suffix}`;
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

function updateLocalFirmSupplierNGstBalance(
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
        n_gst_balance: Number(balances[idx].n_gst_balance || 0) + amountToAdd,
        updated_at: new Date().toISOString(),
      };
    } else {
      balances.push({
        id: 'bal-' + Math.random().toString(36).substring(2, 9),
        firm_id: firmId,
        supplier_id: supplierId,
        gst_balance: 0,
        n_gst_balance: amountToAdd,
        updated_at: new Date().toISOString(),
      });
    }
    localStorage.setItem(LOCAL_SUPPLIER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to update local supplier n_gst balance:', err);
  }
}

/**
 * Insert a record into supplier_transactions.
 */
export async function addSimpleSupplierTransaction(
  input: SupplierTransactionInput
): Promise<{ data: SupplierTransaction | null; error: string | null }> {
  const amountNum = Number(input.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { data: null, error: 'Transaction amount must be greater than 0.' };
  }

  const transaction_code =
    input.transaction_code?.trim() || generateSimpleSupplierTransactionCode();

  const payload = {
    firm_id: input.firm_id,
    supplier_id: input.supplier_id,
    transaction_code,
    transaction_type: input.transaction_type,
    payment_method: input.payment_method,
    amount: amountNum,
    tax_mode: input.tax_mode || 'n_gst',
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
    id: 'nstx-' + Math.random().toString(36).substring(2, 10),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveLocalTransactions([localTx, ...getLocalTransactions()]);
  return { data: localTx, error: null };
}

/**
 * Update firm_supplier_balances.n_gst_balance = firm_supplier_balances.n_gst_balance + amount.
 * Inserts a balance row if one does not exist yet for the firm & supplier pair.
 */
export async function incrementFirmSupplierNGstBalance(
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
        .select('id, n_gst_balance')
        .eq('firm_id', firmId)
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, newBalance: 0, error: fetchErr.message };
      }

      if (existing) {
        const updatedBalance = Number(existing.n_gst_balance || 0) + delta;
        const { error: updateErr } = await supabase
          .from('firm_supplier_balances')
          .update({
            n_gst_balance: updatedBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          return { success: false, newBalance: 0, error: updateErr.message };
        }

        updateLocalFirmSupplierNGstBalance(firmId, supplierId, delta);
        return { success: true, newBalance: updatedBalance, error: null };
      } else {
        const { error: insertErr } = await supabase
          .from('firm_supplier_balances')
          .insert([
            {
              firm_id: firmId,
              supplier_id: supplierId,
              gst_balance: 0,
              n_gst_balance: delta,
            },
          ]);

        if (insertErr) {
          return { success: false, newBalance: 0, error: insertErr.message };
        }

        updateLocalFirmSupplierNGstBalance(firmId, supplierId, delta);
        return { success: true, newBalance: delta, error: null };
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update firm supplier N-GST balance.';
      return { success: false, newBalance: 0, error: msg };
    }
  }

  // Local fallback
  updateLocalFirmSupplierNGstBalance(firmId, supplierId, delta);
  return { success: true, newBalance: delta, error: null };
}

/**
 * Record an N-GST purchase supplier transaction (transaction_type = 'purchase', payment_method = 'NA', tax_mode = 'n_gst')
 * and increment firm_supplier_balances.n_gst_balance by the purchase n_gst_total amount.
 */
export async function recordSimplePurchaseSupplierTransaction(params: {
  firm_id: string;
  supplier_id: string;
  purchase_id: string;
  purchase_number: string;
  invoice_number: string;
  amount: number;
  transaction_date: string;
  notes?: string | null;
}): Promise<{ data: SupplierTransaction | null; error: string | null }> {
  const txResult = await addSimpleSupplierTransaction({
    firm_id: params.firm_id,
    supplier_id: params.supplier_id,
    transaction_type: 'purchase',
    payment_method: 'NA',
    amount: params.amount,
    tax_mode: 'n_gst',
    reference_type: 'purchase',
    reference_id: params.purchase_id,
    transaction_date: params.transaction_date,
    notes:
      params.notes?.trim() ||
      `Purchase ${params.purchase_number} (Invoice: ${params.invoice_number}) [N-GST]`,
  });

  if (txResult.error || !txResult.data) {
    return {
      data: null,
      error: txResult.error || 'Failed to record supplier transaction.',
    };
  }

  const balResult = await incrementFirmSupplierNGstBalance(
    params.firm_id,
    params.supplier_id,
    params.amount
  );

  if (!balResult.success) {
    return {
      data: txResult.data,
      error:
        balResult.error ||
        'Transaction saved, but failed to update supplier N-GST balance.',
    };
  }

  return { data: txResult.data, error: null };
}
