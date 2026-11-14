import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getStoredAuthUser } from '@/lib/auth';

export interface SimpleUserProfile {
  id: string;
  name: string;
  email: string;
}

/**
 * Fetch the current user's profile (name, email) from Supabase or stored auth session.
 */
export async function getSimpleUserProfile(): Promise<SimpleUserProfile | null> {
  const stored = getStoredAuthUser();

  if (isSupabaseConfigured) {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!authErr && authData?.user) {
        const authUser = authData.user;
        const { data: userRow } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', authUser.id)
          .maybeSingle();

        if (userRow) {
          return {
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
          };
        }

        return {
          id: authUser.id,
          name:
            (authUser.user_metadata?.name as string) ||
            authUser.email?.split('@')[0] ||
            'Admin',
          email: authUser.email || stored?.email || '',
        };
      }
    } catch (err) {
      console.warn('Error fetching simple user profile:', err);
    }
  }

  if (stored) {
    return {
      id: stored.id,
      name:
        stored.name ||
        (stored.email ? stored.email.split('@')[0] : 'Admin'),
      email: stored.email,
    };
  }

  return null;
}

/**
 * Verify if the provided code matches the current user's secret_key in public.users.
 */
export async function verifyUserSecretKey(code: string): Promise<{
  valid: boolean;
  error: string | null;
}> {
  const trimmedCode = code.trim();
  if (!trimmedCode) {
    return { valid: false, error: 'Please enter your secret code.' };
  }

  if (!isSupabaseConfigured) {
    return {
      valid: false,
      error: 'Supabase is not configured. Secret key verification requires a connected Supabase project.',
    };
  }

  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const stored = getStoredAuthUser();
    const userId = authData?.user?.id || stored?.id;

    if (authErr && !userId) {
      return {
        valid: false,
        error: authErr.message || 'Unable to identify current user.',
      };
    }

    if (!userId) {
      return { valid: false, error: 'No active user session found.' };
    }

    const { data: userRow, error: rowErr } = await supabase
      .from('users')
      .select('id, secret_key')
      .eq('id', userId)
      .maybeSingle();

    if (rowErr) {
      return { valid: false, error: rowErr.message };
    }

    if (!userRow) {
      return { valid: false, error: 'User record not found.' };
    }

    if (!userRow.secret_key) {
      return {
        valid: false,
        error: 'Secret key is not set for this user.',
      };
    }

    if (userRow.secret_key !== trimmedCode) {
      return { valid: false, error: 'Invalid secret code.' };
    }

    return { valid: true, error: null };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Failed to verify secret key.';
    return { valid: false, error: msg };
  }
}
