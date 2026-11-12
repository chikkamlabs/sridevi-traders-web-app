import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  variant_code: string;
  barcode: string | null;
  conversion_to_base: number;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductVariantInput {
  id?: string;
  product_id?: string;
  variant_name: string;
  variant_code: string;
  barcode?: string;
  conversion_to_base: number;
  status?: boolean;
}

const LOCAL_VARIANTS_KEY = 'st_product_variants_cache';

/**
 * Generate a random 4-digit variant code: var_XXXX
 */
export function generateVariantCode(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `var_${random4}`;
}

function getLocalVariants(): ProductVariant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_VARIANTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProductVariant[];
  } catch {
    return [];
  }
}

function saveLocalVariants(variants: ProductVariant[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_VARIANTS_KEY, JSON.stringify(variants));
  } catch (err) {
    console.error('Failed to save variants locally:', err);
  }
}

/**
 * Fetch all product variants from Supabase.
 */
export async function getAllProductVariants(): Promise<ProductVariant[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formatted: ProductVariant[] = data.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          variant_name: item.variant_name,
          variant_code: item.variant_code,
          barcode: item.barcode || null,
          conversion_to_base: Number(item.conversion_to_base),
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        saveLocalVariants(formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('Error fetching all product variants from Supabase:', err);
    }
  }

  return getLocalVariants();
}

/**
 * Fetch all variants belonging to a specific product.
 */
export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  if (!productId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formatted: ProductVariant[] = data.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          variant_name: item.variant_name,
          variant_code: item.variant_code,
          barcode: item.barcode || null,
          conversion_to_base: Number(item.conversion_to_base),
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        // Merge into local cache
        const local = getLocalVariants().filter((v) => v.product_id !== productId);
        saveLocalVariants([...local, ...formatted]);

        return formatted;
      }
    } catch (err) {
      console.warn(`Error fetching variants for product ${productId}:`, err);
    }
  }

  return getLocalVariants().filter((v) => v.product_id === productId);
}

/**
 * Get map of variant counts per product: { [productId]: count }
 */
export async function getVariantCounts(): Promise<Record<string, number>> {
  const allVariants = await getAllProductVariants();
  const counts: Record<string, number> = {};
  for (const v of allVariants) {
    counts[v.product_id] = (counts[v.product_id] || 0) + 1;
  }
  return counts;
}

/**
 * Add a single product variant.
 */
export async function addProductVariant(
  input: ProductVariantInput
): Promise<{ data: ProductVariant | null; error: string | null }> {
  if (!input.product_id) {
    return { data: null, error: 'Product ID is required for a variant.' };
  }
  const cleanName = input.variant_name.trim();
  if (!cleanName) {
    return { data: null, error: 'Variant name is required.' };
  }
  const variantCode = input.variant_code.trim() || generateVariantCode();
  const conversionToBase = Number(input.conversion_to_base);
  if (isNaN(conversionToBase) || conversionToBase <= 0) {
    return { data: null, error: 'Conversion factor must be greater than 0.' };
  }

  const payload = {
    product_id: input.product_id,
    variant_name: cleanName,
    variant_code: variantCode,
    barcode: input.barcode?.trim() || null,
    conversion_to_base: conversionToBase,
    status: input.status !== undefined ? input.status : true,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .insert([payload])
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const formatted: ProductVariant = {
          id: data.id,
          product_id: data.product_id,
          variant_name: data.variant_name,
          variant_code: data.variant_code,
          barcode: data.barcode,
          conversion_to_base: Number(data.conversion_to_base),
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        const local = getLocalVariants();
        saveLocalVariants([...local, formatted]);
        return { data: formatted, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to insert variant into Supabase.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const newVariant: ProductVariant = {
    id: 'var-' + Math.random().toString(36).substring(2, 9),
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const local = getLocalVariants();
  saveLocalVariants([...local, newVariant]);
  return { data: newVariant, error: null };
}

/**
 * Add multiple product variants for a product.
 */
export async function addProductVariants(
  productId: string,
  variants: ProductVariantInput[]
): Promise<{ data: ProductVariant[] | null; error: string | null }> {
  if (!productId) {
    return { data: null, error: 'Product ID is required.' };
  }
  if (!variants || variants.length === 0) {
    return { data: null, error: 'At least one variant is required.' };
  }

  // Validate all variants first
  const payloads = [];
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const name = v.variant_name.trim();
    if (!name) {
      return { data: null, error: `Variant #${i + 1} name is required.` };
    }
    const conversion = Number(v.conversion_to_base);
    if (isNaN(conversion) || conversion <= 0) {
      return { data: null, error: `Variant "${name}" conversion must be greater than 0.` };
    }
    payloads.push({
      product_id: productId,
      variant_name: name,
      variant_code: v.variant_code.trim() || generateVariantCode(),
      barcode: v.barcode?.trim() || null,
      conversion_to_base: conversion,
      status: v.status !== undefined ? v.status : true,
    });
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .insert(payloads)
        .select();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const formattedList: ProductVariant[] = data.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          variant_name: item.variant_name,
          variant_code: item.variant_code,
          barcode: item.barcode,
          conversion_to_base: Number(item.conversion_to_base),
          status: item.status,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));

        const local = getLocalVariants();
        saveLocalVariants([...local, ...formattedList]);
        return { data: formattedList, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to insert variants.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const localList: ProductVariant[] = payloads.map((p) => ({
    id: 'var-' + Math.random().toString(36).substring(2, 9),
    ...p,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const currentLocal = getLocalVariants();
  saveLocalVariants([...currentLocal, ...localList]);
  return { data: localList, error: null };
}

/**
 * Update an existing product variant.
 */
export async function updateProductVariant(
  id: string,
  updates: Partial<ProductVariantInput>
): Promise<{ data: ProductVariant | null; error: string | null }> {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.variant_name !== undefined) payload.variant_name = updates.variant_name.trim();
  if (updates.variant_code !== undefined) payload.variant_code = updates.variant_code.trim();
  if (updates.barcode !== undefined) payload.barcode = updates.barcode.trim() || null;
  if (updates.conversion_to_base !== undefined) {
    const conv = Number(updates.conversion_to_base);
    if (conv <= 0) return { data: null, error: 'Conversion must be greater than 0.' };
    payload.conversion_to_base = conv;
  }
  if (updates.status !== undefined) payload.status = updates.status;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      if (data) {
        const formatted: ProductVariant = {
          id: data.id,
          product_id: data.product_id,
          variant_name: data.variant_name,
          variant_code: data.variant_code,
          barcode: data.barcode,
          conversion_to_base: Number(data.conversion_to_base),
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        const local = getLocalVariants().map((v) => (v.id === id ? formatted : v));
        saveLocalVariants(local);
        return { data: formatted, error: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update variant.';
      return { data: null, error: msg };
    }
  }

  // Local fallback
  const local = getLocalVariants();
  let found: ProductVariant | null = null;
  const updated = local.map((v) => {
    if (v.id === id) {
      found = { ...v, ...payload };
      return found;
    }
    return v;
  });

  saveLocalVariants(updated);
  return { data: found, error: found ? null : 'Variant not found.' };
}

/**
 * Delete a product variant. Enforces that at least one variant remains for the product.
 */
export async function deleteProductVariant(
  id: string,
  productId: string
): Promise<{ success: boolean; error: string | null }> {
  // Check count of variants for this product
  const existing = await getProductVariants(productId);
  if (existing.length <= 1) {
    return {
      success: false,
      error: 'Cannot delete the only variant. A product must have at least one variant.',
    };
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      const local = getLocalVariants().filter((v) => v.id !== id);
      saveLocalVariants(local);
      return { success: true, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete variant.';
      return { success: false, error: msg };
    }
  }

  // Local fallback
  const local = getLocalVariants().filter((v) => v.id !== id);
  saveLocalVariants(local);
  return { success: true, error: null };
}
