import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  DealerTransaction,
  DealerTransactionInput,
} from '@/lib/dealertrasacationsStore';

const LOCAL_DEALER_TX_KEY = 'st_dealer_transactions_cache';
const LOCAL_DEALER_BALANCES_KEY = 'st_dealer_balances_cache';

export function generateSimpleDealerTransactionCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const suffix = Date.now().toString().slice(-4);
  return `ndtx_${random4}_${suffix}`;
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

function updateLocalFirmDealerNGstBalance(
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
        n_gst_balance: Number(balances[idx].n_gst_balance || 0) + amountToAdd,
        updated_at: new Date().toISOString(),
      };
    } else {
      balances.push({
        id: 'bal-' + Math.random().toString(36).substring(2, 9),
        firm_id: firmId,
        dealer_id: dealerId,
        gst_balance: 0,
        n_gst_balance: amountToAdd,
        updated_at: new Date().toISOString(),
      });
    }
    localStorage.setItem(LOCAL_DEALER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to update local dealer n_gst balance:', err);
  }
}

/**
 * Insert a record into dealer_transactions.
 */
export async function addSimpleDealerTransaction(
  input: DealerTransactionInput
): Promise<{ data: DealerTransaction | null; error: string | null }> {
  const amountNum = Number(input.amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return { data: null, error: 'Transaction amount must be greater than 0.' };
  }

  const transaction_code =
    input.transaction_code?.trim() || generateSimpleDealerTransactionCode();

  const payload = {
    firm_id: input.firm_id,
    dealer_id: input.dealer_id,
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
    id: 'ndtx-' + Math.random().toString(36).substring(2, 10),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  saveLocalDealerTransactions([localTx, ...getLocalDealerTransactions()]);
  return { data: localTx, error: null };
}

/**
 * Update firm_dealer_balances.n_gst_balance = firm_dealer_balances.n_gst_balance + amount.
 * Inserts a balance row if one does not exist yet for the firm & dealer pair.
 */
export async function incrementFirmDealerNGstBalance(
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
        .select('id, n_gst_balance')
        .eq('firm_id', firmId)
        .eq('dealer_id', dealerId)
        .maybeSingle();

      if (fetchErr) {
        return { success: false, newBalance: 0, error: fetchErr.message };
      }

      if (existing) {
        const updatedBalance = Number(existing.n_gst_balance || 0) + delta;
        const { error: updateErr } = await supabase
          .from('firm_dealer_balances')
          .update({
            n_gst_balance: updatedBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          return { success: false, newBalance: 0, error: updateErr.message };
        }

        updateLocalFirmDealerNGstBalance(firmId, dealerId, delta);
        return { success: true, newBalance: updatedBalance, error: null };
      } else {
        const { error: insertErr } = await supabase
          .from('firm_dealer_balances')
          .insert([
            {
              firm_id: firmId,
              dealer_id: dealerId,
              gst_balance: 0,
              n_gst_balance: delta,
            },
          ]);

        if (insertErr) {
          return { success: false, newBalance: 0, error: insertErr.message };
        }

        updateLocalFirmDealerNGstBalance(firmId, dealerId, delta);
        return { success: true, newBalance: delta, error: null };
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to update firm dealer N-GST balance.';
      return { success: false, newBalance: 0, error: msg };
    }
  }

  // Local fallback
  updateLocalFirmDealerNGstBalance(firmId, dealerId, delta);
  return { success: true, newBalance: delta, error: null };
}

/**
 * Record an N-GST sale dealer transaction (transaction_type = 'sale', payment_method = 'NA', tax_mode = 'n_gst')
 * and increment firm_dealer_balances.n_gst_balance by the sale n_gst_total amount.
 */
export async function recordSimpleSaleDealerTransaction(params: {
  firm_id: string;
  dealer_id: string;
  sales_bill_id: string;
  sale_number: string;
  invoice_number: string;
  amount: number;
  transaction_date: string;
  notes?: string | null;
}): Promise<{ data: DealerTransaction | null; error: string | null }> {
  const txResult = await addSimpleDealerTransaction({
    firm_id: params.firm_id,
    dealer_id: params.dealer_id,
    transaction_type: 'sale',
    payment_method: 'NA',
    amount: params.amount,
    tax_mode: 'n_gst',
    reference_type: 'sale',
    reference_id: params.sales_bill_id,
    transaction_date: params.transaction_date,
    notes:
      params.notes?.trim() ||
      `Sale ${params.sale_number} (Invoice: ${params.invoice_number}) [N-GST]`,
  });

  if (txResult.error || !txResult.data) {
    return {
      data: null,
      error: txResult.error || 'Failed to record dealer transaction.',
    };
  }

  const balResult = await incrementFirmDealerNGstBalance(
    params.firm_id,
    params.dealer_id,
    params.amount
  );

  if (!balResult.success) {
    return {
      data: txResult.data,
      error:
        balResult.error ||
        'Transaction saved, but failed to update dealer N-GST balance.',
    };
  }

  return { data: txResult.data, error: null };
}
