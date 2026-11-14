import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  getStoredAuthUser,
  signOut,
  updateUserPassword,
} from '@/lib/auth';

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch current authenticated admin profile from Supabase Auth & public.users table.
 */
export async function getAdminProfile(): Promise<{
  data: AdminProfile | null;
  error: string | null;
}> {
  const stored = getStoredAuthUser();

  if (isSupabaseConfigured) {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!authErr && authData?.user) {
        const authUser = authData.user;
        const { data: userRow, error: rowErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!rowErr && userRow) {
          return {
            data: {
              id: userRow.id,
              name: userRow.name,
              email: userRow.email,
              phone: userRow.phone || null,
              role: userRow.role,
              status: userRow.status,
              created_at: userRow.created_at,
              updated_at: userRow.updated_at,
            },
            error: null,
          };
        }

        // Fallback to auth user metadata if public.users row is not present
        return {
          data: {
            id: authUser.id,
            name:
              (authUser.user_metadata?.name as string) ||
              authUser.email?.split('@')[0] ||
              'Admin',
            email: authUser.email || stored?.email || '',
            phone: authUser.phone || null,
            role:
              (authUser.user_metadata?.role as string) ||
              stored?.role ||
              'admin',
            status: true,
            created_at: authUser.created_at,
          },
          error: null,
        };
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to fetch profile.';
      return { data: null, error: msg };
    }
  }

  if (stored) {
    return {
      data: {
        id: stored.id,
        name:
          stored.name ||
          (stored.email ? stored.email.split('@')[0] : 'Admin'),
        email: stored.email,
        phone: null,
        role: stored.role || 'admin',
        status: true,
      },
      error: null,
    };
  }

  return { data: null, error: 'No active user session found.' };
}

/**
 * Change current authenticated user's password in Supabase Auth.
 */
export async function changeAdminPassword(newPassword: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!newPassword || newPassword.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters long.',
    };
  }

  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase is not configured. Password changes require a connected Supabase project.',
    };
  }

  try {
    const { error } = await updateUserPassword(newPassword);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Failed to update password.';
    return { success: false, error: msg };
  }
}

/**
 * Logout current admin user from Supabase and clear session.
 */
export async function logoutAdmin(): Promise<{ error: string | null }> {
  const { error } = await signOut();
  return { error: error ? error.message : null };
}
