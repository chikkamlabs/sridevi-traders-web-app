import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Unit {
  id: string;
  name: string;
  use_name: string;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UnitInput {
  name: string;
  use_name: string;
  status?: boolean;
}

const LOCAL_UNITS_KEY = 'st_units_cache';

function getLocalUnits(): Unit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_UNITS_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Unit[];
  } catch {
    return [];
  }
}

function saveLocalUnits(units: Unit[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_UNITS_KEY, JSON.stringify(units));
  } catch (err) {
    console.error('Failed to save units locally:', err);
  }
}

/**
 * Fetch all units from Supabase (or fallback to local cache).
 */
export async function getUnits(): Promise<Unit[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Error fetching units from Supabase, using local cache:', error.message);
        return getLocalUnits();
      }

      if (data && data.length > 0) {
        saveLocalUnits(data);
        return data as Unit[];
      }
      return getLocalUnits();
    } catch (err) {
      console.warn('Supabase getUnits exception:', err);
      return getLocalUnits();
    }
  }

  return getLocalUnits();
}

/**
 * Get count of all units.
 */
export async function getUnitsCount(): Promise<number> {
  const units = await getUnits();
  return units.length;
}

/**
 * Get unit by ID.
 */
export async function getUnitById(id: string): Promise<Unit | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data as Unit;
      }
    } catch (err) {
      console.warn('Error fetching unit by ID:', err);
    }
  }

  const local = getLocalUnits();
  return local.find((u) => u.id === id) || null;
}

/**
 * Insert a new unit into units table.
 */
export async function addUnit(unit: UnitInput): Promise<{ data: Unit | null; error: string | null }> {
  const trimmedName = unit.name.trim();
  const trimmedUseName = unit.use_name.trim();
  const status = unit.status !== undefined ? unit.status : true;

  if (!trimmedName || !trimmedUseName) {
    return { data: null, error: 'Unit name and usage name are required.' };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('units')
        .insert([
          {
            name: trimmedName,
            use_name: trimmedUseName,
            status,
          },
        ])
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalUnits();
        saveLocalUnits([...local, data as Unit]);
        return { data: data as Unit, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to insert unit into Supabase.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newUnit: Unit = {
    id: 'u-' + Math.random().toString(36).substring(2, 9),
    name: trimmedName,
    use_name: trimmedUseName,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const current = getLocalUnits();
  const updated = [newUnit, ...current];
  saveLocalUnits(updated);

  return { data: newUnit, error: null };
}

/**
 * Update an existing unit.
 */
export async function updateUnit(
  id: string,
  updates: Partial<UnitInput>
): Promise<{ data: Unit | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('units')
        .update({
          ...(updates.name && { name: updates.name.trim() }),
          ...(updates.use_name && { use_name: updates.use_name.trim() }),
          ...(updates.status !== undefined && { status: updates.status }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalUnits().map((u) => (u.id === id ? (data as Unit) : u));
        saveLocalUnits(local);
        return { data: data as Unit, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update unit.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const local = getLocalUnits();
  let found: Unit | null = null;
  const updated = local.map((u) => {
    if (u.id === id) {
      found = {
        ...u,
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.use_name && { use_name: updates.use_name.trim() }),
        ...(updates.status !== undefined && { status: updates.status }),
        updated_at: new Date().toISOString(),
      };
      return found;
    }
    return u;
  });

  saveLocalUnits(updated);
  return { data: found, error: found ? null : 'Unit not found' };
}
