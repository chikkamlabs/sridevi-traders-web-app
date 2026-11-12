import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms, Firm } from '@/lib/firmsStore';

export interface DealerBalance {
  id?: string;
  firm_id: string;
  firm_name?: string;
  dealer_id: string;
  gst_balance: number;
  n_gst_balance: number;
  updated_at?: string;
}

export interface Dealer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  status: boolean;
  total_balance?: number;
  balances?: DealerBalance[];
  created_at?: string;
  updated_at?: string;
}

export interface DealerInput {
  name: string;
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

const LOCAL_DEALERS_KEY = 'st_dealers_cache';
const LOCAL_DEALER_BALANCES_KEY = 'st_dealer_balances_cache';

function getLocalDealers(): Dealer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Dealer[];
  } catch {
    return [];
  }
}

function saveLocalDealers(dealers: Dealer[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DEALERS_KEY, JSON.stringify(dealers));
  } catch (err) {
    console.error('Failed to save dealers locally:', err);
  }
}

function getLocalDealerBalances(): DealerBalance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALER_BALANCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DealerBalance[];
  } catch {
    return [];
  }
}

function saveLocalDealerBalances(balances: DealerBalance[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DEALER_BALANCES_KEY, JSON.stringify(balances));
  } catch (err) {
    console.error('Failed to save dealer balances locally:', err);
  }
}

/**
 * Fetch all dealers with calculated total_balance from firm_dealer_balances.
 */
export async function getDealers(): Promise<Dealer[]> {
  const firms = await getFirms();
  const firmMap = new Map<string, string>();
  firms.forEach((f) => firmMap.set(f.id, f.name));

  if (isSupabaseConfigured) {
    try {
      const { data: dealersData, error: dealersErr } = await supabase
        .from('dealers')
        .select('*')
        .order('created_at', { ascending: false });

      if (dealersErr) {
        console.warn('Error fetching dealers from Supabase:', dealersErr.message);
        return attachBalancesToDealers(getLocalDealers(), getLocalDealerBalances(), firmMap);
      }

      if (dealersData) {
        // Fetch all firm_dealer_balances
        const { data: balancesData } = await supabase
          .from('firm_dealer_balances')
          .select('*');

        const balances: DealerBalance[] = (balancesData || []).map((b: any) => ({
          id: b.id,
          firm_id: b.firm_id,
          dealer_id: b.dealer_id,
          gst_balance: Number(b.gst_balance || 0),
          n_gst_balance: Number(b.n_gst_balance || 0),
          updated_at: b.updated_at,
          firm_name: firmMap.get(b.firm_id) || 'Unknown Firm',
        }));

        saveLocalDealers(dealersData as Dealer[]);
        saveLocalDealerBalances(balances);

        return attachBalancesToDealers(dealersData as Dealer[], balances, firmMap);
      }
    } catch (err) {
      console.warn('Supabase getDealers exception:', err);
    }
  }

  return attachBalancesToDealers(getLocalDealers(), getLocalDealerBalances(), firmMap);
}

function attachBalancesToDealers(
  dealers: Dealer[],
  balances: DealerBalance[],
  firmMap: Map<string, string>
): Dealer[] {
  return dealers.map((d) => {
    const dealerBals = balances.filter((b) => b.dealer_id === d.id);
    const totalGst = dealerBals.reduce((sum, b) => sum + Number(b.gst_balance || 0), 0);
    return {
      ...d,
      total_balance: totalGst,
      balances: dealerBals.map((b) => ({
        ...b,
        firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
      })),
    };
  });
}

/**
 * Get count of all dealers.
 */
export async function getDealersCount(): Promise<number> {
  const dealers = await getDealers();
  return dealers.length;
}

/**
 * Get dealer by ID with detailed firm balances.
 */
export async function getDealerById(id: string): Promise<Dealer | null> {
  const dealers = await getDealers();
  return dealers.find((d) => d.id === id) || null;
}

/**
 * Insert a new dealer into dealers table and record opening balance in firm_dealer_balances.
 */
export async function addDealer(
  dealerInput: DealerInput
): Promise<{ data: Dealer | null; error: string | null }> {
  const cleanName = dealerInput.name.trim();
  if (!cleanName) {
    return { data: null, error: 'Dealer name is required.' };
  }

  const payload = {
    name: cleanName,
    phone: dealerInput.phone?.trim() || null,
    email: dealerInput.email?.trim() || null,
    gst_number: dealerInput.gst_number?.trim().toUpperCase() || null,
    city: dealerInput.city?.trim() || null,
    address: dealerInput.address?.trim() || null,
    notes: dealerInput.notes?.trim() || null,
    status: dealerInput.status !== undefined ? dealerInput.status : true,
  };

  // Consolidate balances from opening_balances array or single opening_firm_id
  const openingBalancesToInsert: Array<{ firm_id: string; balance: number }> = [];
  if (dealerInput.opening_balances && dealerInput.opening_balances.length > 0) {
    dealerInput.opening_balances.forEach((ob) => {
      if (ob.firm_id) {
        openingBalancesToInsert.push({
          firm_id: ob.firm_id,
          balance: Number(ob.balance || 0),
        });
      }
    });
  } else if (dealerInput.opening_firm_id && Number(dealerInput.opening_balance || 0) > 0) {
    openingBalancesToInsert.push({
      firm_id: dealerInput.opening_firm_id,
      balance: Number(dealerInput.opening_balance),
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
      // 1. Insert dealer
      const { data: newDealer, error: dealerErr } = await supabase
        .from('dealers')
        .insert([payload])
        .select()
        .single();

      if (dealerErr || !newDealer) {
        return { data: null, error: dealerErr?.message || 'Failed to insert dealer.' };
      }

      // 2. Insert opening balances into firm_dealer_balances
      const addedBalances: DealerBalance[] = [];
      if (openingBalancesToInsert.length > 0) {
        const rowsToInsert = openingBalancesToInsert.map((ob) => ({
          firm_id: ob.firm_id,
          dealer_id: newDealer.id,
          gst_balance: ob.balance,
          n_gst_balance: 0,
        }));

        const { data: balData, error: balErr } = await supabase
          .from('firm_dealer_balances')
          .insert(rowsToInsert)
          .select();

        if (!balErr && balData) {
          balData.forEach((b: any) => {
            addedBalances.push({
              id: b.id,
              firm_id: b.firm_id,
              dealer_id: b.dealer_id,
              gst_balance: Number(b.gst_balance),
              n_gst_balance: Number(b.n_gst_balance),
              firm_name: firmMap.get(b.firm_id) || 'Firm',
            });
          });

          const localBals = getLocalDealerBalances();
          saveLocalDealerBalances([...localBals, ...addedBalances]);
        }
      }

      const formattedDealer: Dealer = {
        ...newDealer,
        total_balance: totalCalculatedBalance,
        balances: addedBalances,
      };

      const localDealers = getLocalDealers();
      saveLocalDealers([formattedDealer, ...localDealers]);

      return { data: formattedDealer, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Exception adding dealer.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newId = 'dlr-' + Math.random().toString(36).substring(2, 9);
  const localBalances: DealerBalance[] = openingBalancesToInsert.map((ob) => ({
    id: 'bal-' + Math.random().toString(36).substring(2, 9),
    firm_id: ob.firm_id,
    dealer_id: newId,
    gst_balance: ob.balance,
    n_gst_balance: 0,
    firm_name: firmMap.get(ob.firm_id) || 'Firm',
    updated_at: new Date().toISOString(),
  }));

  const localDealer: Dealer = {
    id: newId,
    ...payload,
    total_balance: totalCalculatedBalance,
    balances: localBalances,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (localBalances.length > 0) {
    const currentBals = getLocalDealerBalances();
    saveLocalDealerBalances([...currentBals, ...localBalances]);
  }

  const currentDealers = getLocalDealers();
  saveLocalDealers([localDealer, ...currentDealers]);

  return { data: localDealer, error: null };
}

/**
 * Update an existing dealer. Does NOT allow changing balances (read-only view).
 */
export async function updateDealer(
  id: string,
  updates: Partial<DealerInput>
): Promise<{ data: Dealer | null; error: string | null }> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
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
        .from('dealers')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalDealers().map((d) => (d.id === id ? { ...d, ...data } : d));
        saveLocalDealers(local);
        return { data: data as Dealer, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update dealer.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const local = getLocalDealers();
  let found: Dealer | null = null;
  const updated = local.map((d) => {
    if (d.id === id) {
      found = {
        ...d,
        ...payload,
      };
      return found;
    }
    return d;
  });

  saveLocalDealers(updated);
  return { data: found, error: found ? null : 'Dealer not found.' };
}
