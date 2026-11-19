import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getUnits, Unit } from '@/lib/unitsStore';

export interface Category {
  id: string;
  name: string;
  category_code: string;
  status: boolean;
}

export interface Product {
  id: string;
  name: string;
  product_code: string;
  hsn_code?: string | null;
  category_id: string;
  base_unit_id: string;
  minimum_stock: number;
  quantity: number;
  status: boolean;
  category_name?: string;
  unit_name?: string;
  unit_use_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductInput {
  name: string;
  hsn_code?: string;
  category_id: string;
  base_unit_id: string;
  minimum_stock: number;
  quantity: number;
  status?: boolean;
}

const LOCAL_PRODUCTS_KEY = 'st_products_cache';
const LOCAL_CATEGORIES_KEY = 'st_categories_cache';

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

function getLocalProducts(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PRODUCTS_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
}

function saveLocalProducts(products: Product[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
  } catch (err) {
    console.error('Failed to save products locally:', err);
  }
}

/**
 * Fetch all categories from Supabase (or fallback).
 */
export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Category[];
      }
    } catch (err) {
      console.warn('Error fetching categories from Supabase:', err);
    }
  }

  return getLocalCategories();
}

/**
 * Generate a random 4-digit product code: prod_XXXX
 */
export function generateProductCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `prod_${random4}`;
}

/**
 * Fetch products with joined category and unit information.
 */
export async function getProducts(options?: {
  categoryId?: string;
  search?: string;
}): Promise<Product[]> {
  let productsList: Product[] = [];

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          product_code,
          hsn_code,
          category_id,
          base_unit_id,
          minimum_stock,
          quantity,
          status,
          created_at,
          updated_at,
          categories ( name ),
          units ( name, use_name )
        `)
        .order('created_at', { ascending: false });

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        // Format joined data
        productsList = data.map((item: any) => ({
          id: item.id,
          name: item.name,
          product_code: item.product_code,
          hsn_code: item.hsn_code || '',
          category_id: item.category_id,
          base_unit_id: item.base_unit_id,
          minimum_stock: Number(item.minimum_stock),
          quantity: Number(item.quantity),
          status: item.status,
          category_name: item.categories?.name || 'General',
          unit_name: item.units?.name || 'Unit',
          unit_use_name: item.units?.use_name || '',
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        saveLocalProducts(productsList);
      } else {
        productsList = getLocalProducts();
      }
    } catch (err) {
      console.warn('Error fetching products from Supabase:', err);
      productsList = getLocalProducts();
    }
  } else {
    productsList = getLocalProducts();
  }

  // Client-side category filtering
  if (options?.categoryId) {
    productsList = productsList.filter((p) => p.category_id === options.categoryId);
  }

  // Search filtering by product_code, hsn_code, and name
  if (options?.search) {
    const s = options.search.trim().toLowerCase();
    productsList = productsList.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.product_code.toLowerCase().includes(s) ||
        (p.hsn_code && p.hsn_code.toLowerCase().includes(s))
    );
  }

  return productsList;
}

/**
 * Get total product count.
 */
export async function getProductsCount(): Promise<number> {
  const all = await getProducts();
  return all.length;
}

/**
 * Get product by ID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const [categories, units] = await Promise.all([getCategories(), getUnits()]);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          product_code,
          hsn_code,
          category_id,
          base_unit_id,
          minimum_stock,
          quantity,
          status,
          created_at,
          updated_at,
          categories ( name ),
          units ( name, use_name )
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const item: any = data;
        return {
          id: item.id,
          name: item.name,
          product_code: item.product_code,
          hsn_code: item.hsn_code || '',
          category_id: item.category_id,
          base_unit_id: item.base_unit_id,
          minimum_stock: Number(item.minimum_stock),
          quantity: Number(item.quantity),
          status: item.status,
          category_name: item.categories?.name,
          unit_name: item.units?.name,
          unit_use_name: item.units?.use_name,
          created_at: item.created_at,
          updated_at: item.updated_at,
        };
      }
    } catch (err) {
      console.warn('Error fetching product by ID:', err);
    }
  }

  // Fallback to local
  const local = getLocalProducts();
  const prod = local.find((p) => p.id === id);
  if (!prod) return null;

  const category = categories.find((c) => c.id === prod.category_id);
  const unit = units.find((u) => u.id === prod.base_unit_id);

  return {
    ...prod,
    category_name: category?.name || prod.category_name || 'General',
    unit_name: unit?.name || prod.unit_name || 'Unit',
    unit_use_name: unit?.use_name || prod.unit_use_name || '',
  };
}

/**
 * Add a new product with auto-generated product_code: prod_XXXX
 */
export async function addProduct(
  input: ProductInput
): Promise<{ data: Product | null; error: string | null }> {
  const product_code = generateProductCode();
  const cleanName = input.name.trim();

  if (!cleanName) {
    return { data: null, error: 'Product name is required.' };
  }
  if (!input.category_id) {
    return { data: null, error: 'Please select a product category.' };
  }
  if (!input.base_unit_id) {
    return { data: null, error: 'Please select a base measurement unit.' };
  }

  const [categories, units] = await Promise.all([getCategories(), getUnits()]);
  const cat = categories.find((c) => c.id === input.category_id);
  const unit = units.find((u) => u.id === input.base_unit_id);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            name: cleanName,
            product_code,
            hsn_code: input.hsn_code?.trim() || null,
            category_id: input.category_id,
            base_unit_id: input.base_unit_id,
            minimum_stock: input.minimum_stock || 0,
            quantity: input.quantity || 0,
            status: input.status ?? true,
          },
        ])
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const formatted: Product = {
          id: data.id,
          name: data.name,
          product_code: data.product_code,
          hsn_code: data.hsn_code || '',
          category_id: data.category_id,
          base_unit_id: data.base_unit_id,
          minimum_stock: Number(data.minimum_stock),
          quantity: Number(data.quantity),
          status: data.status,
          category_name: cat?.name || 'General',
          unit_name: unit?.name || 'Unit',
          unit_use_name: unit?.use_name || '',
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        const local = getLocalProducts();
        saveLocalProducts([formatted, ...local]);
        return { data: formatted, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to insert product into Supabase.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newProduct: Product = {
    id: 'prod-' + Math.random().toString(36).substring(2, 9),
    name: cleanName,
    product_code,
    hsn_code: input.hsn_code?.trim() || '',
    category_id: input.category_id,
    base_unit_id: input.base_unit_id,
    minimum_stock: Number(input.minimum_stock) || 0,
    quantity: Number(input.quantity) || 0,
    status: input.status ?? true,
    category_name: cat?.name || 'General',
    unit_name: unit?.name || 'Unit',
    unit_use_name: unit?.use_name || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const local = getLocalProducts();
  saveLocalProducts([newProduct, ...local]);
  return { data: newProduct, error: null };
}

/**
 * Update an existing product (excluding product_code).
 */
export async function updateProduct(
  id: string,
  updates: Partial<ProductInput>
): Promise<{ data: Product | null; error: string | null }> {
  const [categories, units] = await Promise.all([getCategories(), getUnits()]);

  if (isSupabaseConfigured) {
    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.hsn_code !== undefined) payload.hsn_code = updates.hsn_code.trim() || null;
      if (updates.category_id !== undefined) payload.category_id = updates.category_id;
      if (updates.base_unit_id !== undefined) payload.base_unit_id = updates.base_unit_id;
      if (updates.minimum_stock !== undefined) payload.minimum_stock = Number(updates.minimum_stock);
      if (updates.quantity !== undefined) payload.quantity = Number(updates.quantity);
      if (updates.status !== undefined) payload.status = updates.status;

      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const cat = categories.find((c) => c.id === data.category_id);
        const unit = units.find((u) => u.id === data.base_unit_id);

        const formatted: Product = {
          id: data.id,
          name: data.name,
          product_code: data.product_code, // Never edited
          hsn_code: data.hsn_code || '',
          category_id: data.category_id,
          base_unit_id: data.base_unit_id,
          minimum_stock: Number(data.minimum_stock),
          quantity: Number(data.quantity),
          status: data.status,
          category_name: cat?.name || 'General',
          unit_name: unit?.name || 'Unit',
          unit_use_name: unit?.use_name || '',
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        const local = getLocalProducts().map((p) => (p.id === id ? formatted : p));
        saveLocalProducts(local);
        return { data: formatted, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update product.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const local = getLocalProducts();
  let updatedProduct: Product | null = null;

  const updated = local.map((p) => {
    if (p.id === id) {
      const catId = updates.category_id !== undefined ? updates.category_id : p.category_id;
      const unitId = updates.base_unit_id !== undefined ? updates.base_unit_id : p.base_unit_id;
      const cat = categories.find((c) => c.id === catId);
      const unit = units.find((u) => u.id === unitId);

      updatedProduct = {
        ...p,
        ...(updates.name !== undefined && { name: updates.name.trim() }),
        ...(updates.hsn_code !== undefined && { hsn_code: updates.hsn_code.trim() }),
        ...(updates.category_id !== undefined && { category_id: updates.category_id }),
        ...(updates.base_unit_id !== undefined && { base_unit_id: updates.base_unit_id }),
        ...(updates.minimum_stock !== undefined && { minimum_stock: Number(updates.minimum_stock) }),
        ...(updates.quantity !== undefined && { quantity: Number(updates.quantity) }),
        ...(updates.status !== undefined && { status: updates.status }),
        category_name: cat?.name || p.category_name,
        unit_name: unit?.name || p.unit_name,
        unit_use_name: unit?.use_name || p.unit_use_name,
        updated_at: new Date().toISOString(),
      };
      return updatedProduct;
    }
    return p;
  });

  saveLocalProducts(updated);
  return { data: updatedProduct, error: updatedProduct ? null : 'Product not found.' };
}
