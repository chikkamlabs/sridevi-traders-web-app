import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Firm {
  id: string;
  name: string;
  legal_name?: string | null;
  gst_number?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FirmInput {
  name: string;
  legal_name?: string;
  gst_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string;
  status?: boolean;
}

const LOCAL_FIRMS_KEY = 'st_firms_cache';

function getLocalFirms(): Firm[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_FIRMS_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Firm[];
  } catch {
    return [];
  }
}

function saveLocalFirms(firms: Firm[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_FIRMS_KEY, JSON.stringify(firms));
  } catch (err) {
    console.error('Failed to save firms locally:', err);
  }
}

/**
 * Fetch all firms from Supabase (or fallback to local cache).
 */
export async function getFirms(): Promise<Firm[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('firms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching firms from Supabase, using local fallback:', error.message);
        return getLocalFirms();
      }

      if (data && data.length > 0) {
        saveLocalFirms(data as Firm[]);
        return data as Firm[];
      }
      return getLocalFirms();
    } catch (err) {
      console.warn('Supabase getFirms exception:', err);
      return getLocalFirms();
    }
  }

  return getLocalFirms();
}

/**
 * Get total firm count.
 */
export async function getFirmsCount(): Promise<number> {
  const firms = await getFirms();
  return firms.length;
}

/**
 * Get firm by ID.
 */
export async function getFirmById(id: string): Promise<Firm | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('firms')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data as Firm;
      }
    } catch (err) {
      console.warn('Error fetching firm by ID:', err);
    }
  }

  const local = getLocalFirms();
  return local.find((f) => f.id === id) || null;
}

/**
 * Insert a new firm into firms table.
 */
export async function addFirm(firm: FirmInput): Promise<{ data: Firm | null; error: string | null }> {
  const trimmedName = firm.name.trim();

  if (!trimmedName) {
    return { data: null, error: 'Firm name is required.' };
  }

  const payload = {
    name: trimmedName,
    legal_name: firm.legal_name?.trim() || null,
    gst_number: firm.gst_number?.trim().toUpperCase() || null,
    phone: firm.phone?.trim() || null,
    email: firm.email?.trim() || null,
    address: firm.address?.trim() || null,
    logo_url: firm.logo_url?.trim() || null,
    status: firm.status !== undefined ? firm.status : true,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('firms')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalFirms();
        saveLocalFirms([data as Firm, ...local]);
        return { data: data as Firm, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to insert firm into Supabase.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newFirm: Firm = {
    id: 'firm-' + Math.random().toString(36).substring(2, 9),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const current = getLocalFirms();
  const updated = [newFirm, ...current];
  saveLocalFirms(updated);

  return { data: newFirm, error: null };
}

/**
 * Update an existing firm in firms table.
 */
export async function updateFirm(
  id: string,
  updates: Partial<FirmInput>
): Promise<{ data: Firm | null; error: string | null }> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.legal_name !== undefined) payload.legal_name = updates.legal_name.trim() || null;
  if (updates.gst_number !== undefined) payload.gst_number = updates.gst_number.trim().toUpperCase() || null;
  if (updates.phone !== undefined) payload.phone = updates.phone.trim() || null;
  if (updates.email !== undefined) payload.email = updates.email.trim() || null;
  if (updates.address !== undefined) payload.address = updates.address.trim() || null;
  if (updates.logo_url !== undefined) payload.logo_url = updates.logo_url.trim() || null;
  if (updates.status !== undefined) payload.status = updates.status;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('firms')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalFirms().map((f) => (f.id === id ? (data as Firm) : f));
        saveLocalFirms(local);
        return { data: data as Firm, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update firm.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const local = getLocalFirms();
  let found: Firm | null = null;
  const updated = local.map((f) => {
    if (f.id === id) {
      found = {
        ...f,
        ...payload,
      };
      return found;
    }
    return f;
  });

  saveLocalFirms(updated);
  return { data: found, error: found ? null : 'Firm not found.' };
}
