import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFirms } from '@/lib/firmsStore';

export interface SimpleDealerBalance {
  id?: string;
  firm_id: string;
  firm_name?: string;
  dealer_id: string;
  gst_balance: number;
  n_gst_balance: number;
  updated_at?: string;
}

export interface SimpleDealer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  status: boolean;
  total_balance: number;
  balances?: SimpleDealerBalance[];
  created_at?: string;
  updated_at?: string;
}

const LOCAL_DEALERS_KEY = 'st_dealers_cache';
const LOCAL_DEALER_BALANCES_KEY = 'st_dealer_balances_cache';

function getLocalDealers(): SimpleDealer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleDealer[];
  } catch {
    return [];
  }
}

function getLocalDealerBalances(): SimpleDealerBalance[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DEALER_BALANCES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SimpleDealerBalance[];
  } catch {
    return [];
  }
}

function attachNGstBalancesToDealers(
  dealers: any[],
  balances: SimpleDealerBalance[],
  firmMap: Map<string, string>
): SimpleDealer[] {
  return dealers.map((d) => {
    const dealerBals = balances.filter((b) => b.dealer_id === d.id);
    const totalNGst = dealerBals.reduce(
      (sum, b) => sum + Number(b.n_gst_balance || 0),
      0
    );
    return {
      ...d,
      total_balance: totalNGst,
      balances: dealerBals.map((b) => ({
        ...b,
        firm_name: firmMap.get(b.firm_id) || b.firm_name || 'Firm',
      })),
    };
  });
}

/**
 * Fetch all dealers with total_balance calculated as the sum of all n_gst_balance values in firm_dealer_balances.
 */
export async function getSimpleDealers(): Promise<SimpleDealer[]> {
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
        console.warn('Error fetching simple dealers from Supabase:', dealersErr.message);
        return attachNGstBalancesToDealers(
          getLocalDealers(),
          getLocalDealerBalances(),
          firmMap
        );
      }

      if (dealersData) {
        const { data: balancesData } = await supabase
          .from('firm_dealer_balances')
          .select('*');

        const balances: SimpleDealerBalance[] = (balancesData || []).map((b: any) => ({
          id: b.id,
          firm_id: b.firm_id,
          dealer_id: b.dealer_id,
          gst_balance: Number(b.gst_balance || 0),
          n_gst_balance: Number(b.n_gst_balance || 0),
          updated_at: b.updated_at,
          firm_name: firmMap.get(b.firm_id) || 'Unknown Firm',
        }));

        return attachNGstBalancesToDealers(dealersData, balances, firmMap);
      }
    } catch (err) {
      console.warn('Supabase getSimpleDealers exception:', err);
    }
  }

  return attachNGstBalancesToDealers(
    getLocalDealers(),
    getLocalDealerBalances(),
    firmMap
  );
}

/**
 * Fetch a single dealer by ID with N-GST total_balance and firm_dealer_balances.
 */
export async function getSimpleDealerById(
  id: string
): Promise<SimpleDealer | null> {
  if (!id) return null;
  const dealers = await getSimpleDealers();
  return dealers.find((d) => d.id === id) || null;
}
