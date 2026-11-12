import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Category {
  id: string;
  category_code: string;
  name: string;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryInput {
  name: string;
  category_code?: string;
  status?: boolean;
}

const LOCAL_CATEGORIES_KEY = 'st_categories_master_cache';

function getLocalCategories(): Category[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CATEGORIES_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Category[];
  } catch {
    return [];
  }
}

function saveLocalCategories(cats: Category[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(cats));
  } catch (err) {
    console.error('Failed to save categories locally:', err);
  }
}

/**
 * Generate a random 4-digit category code: cat_XXXX
 */
export function generateCategoryCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `cat_${random4}`;
}

/**
 * Fetch all categories from Supabase (or fallback to local cache).
 */
export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Error fetching categories from Supabase, using local fallback:', error.message);
        return getLocalCategories();
      }

      if (data && data.length > 0) {
        saveLocalCategories(data as Category[]);
        return data as Category[];
      }
      return getLocalCategories();
    } catch (err) {
      console.warn('Supabase getCategories exception:', err);
      return getLocalCategories();
    }
  }

  return getLocalCategories();
}

/**
 * Get count of all categories.
 */
export async function getCategoriesCount(): Promise<number> {
  const cats = await getCategories();
  return cats.length;
}

/**
 * Get category by ID.
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return data as Category;
      }
    } catch (err) {
      console.warn('Error fetching category by ID:', err);
    }
  }

  const local = getLocalCategories();
  return local.find((c) => c.id === id) || null;
}

/**
 * Insert a new category into categories table with auto-generated cat_(4 random numbers) code.
 */
export async function addCategory(
  input: CategoryInput
): Promise<{ data: Category | null; error: string | null }> {
  const cleanName = input.name.trim();
  const category_code = input.category_code?.trim() || generateCategoryCode();
  const status = input.status !== undefined ? input.status : true;

  if (!cleanName) {
    return { data: null, error: 'Category name is required.' };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([
          {
            name: cleanName,
            category_code,
            status,
          },
        ])
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalCategories();
        saveLocalCategories([data as Category, ...local]);
        return { data: data as Category, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to insert category into Supabase.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newCat: Category = {
    id: 'cat-' + Math.random().toString(36).substring(2, 9),
    category_code,
    name: cleanName,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const current = getLocalCategories();
  const updated = [newCat, ...current];
  saveLocalCategories(updated);

  return { data: newCat, error: null };
}

/**
 * Update an existing category.
 */
export async function updateCategory(
  id: string,
  updates: Partial<CategoryInput>
): Promise<{ data: Category | null; error: string | null }> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.category_code !== undefined) payload.category_code = updates.category_code.trim();
  if (updates.status !== undefined) payload.status = updates.status;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const local = getLocalCategories().map((c) => (c.id === id ? (data as Category) : c));
        saveLocalCategories(local);
        return { data: data as Category, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update category.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const local = getLocalCategories();
  let found: Category | null = null;
  const updated = local.map((c) => {
    if (c.id === id) {
      found = {
        ...c,
        ...payload,
      };
      return found;
    }
    return c;
  });

  saveLocalCategories(updated);
  return { data: found, error: found ? null : 'Category not found.' };
}
