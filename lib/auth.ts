import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  authenticated: boolean;
  name?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  role: string;
  error: Error | null;
  errorDetail?: string;
}

const AUTH_COOKIE_NAME = 'st_auth';
const AUTH_STORAGE_KEY = 'st_auth_user';

/**
 * Sets auth cookie with cross-environment and iframe compatibility.
 */
export function setAuthCookie(role: string = 'admin'): void {
  if (typeof document === 'undefined') return;

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  // Standard Lax cookie for regular navigation
  document.cookie = `${AUTH_COOKIE_NAME}=${role}; path=/; max-age=86400; SameSite=Lax`;

  // None; Secure cookie for HTTPS / iframe contexts (e.g. AI Studio preview)
  if (isHttps) {
    document.cookie = `${AUTH_COOKIE_NAME}=${role}; path=/; max-age=86400; SameSite=None; Secure`;
  }
}

/**
 * Clears the auth cookie.
 */
export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Stores local authenticated session in localStorage.
 */
export function setStoredAuthUser(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to save auth user to localStorage:', err);
  }
}

/**
 * Retrieves the stored user from localStorage.
 */
export function getStoredAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Removes the stored user from localStorage.
 */
export function clearStoredAuthUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to remove auth user from localStorage:', err);
  }
}

/**
 * Sets both localStorage and document cookies for an active session.
 */
export function setAuthSession(user: { email: string; role?: string; id?: string; name?: string }): void {
  const role = user.role || 'admin';
  const authUser: AuthUser = {
    id: user.id || 'usr_' + Math.random().toString(36).substring(2, 9),
    email: user.email,
    role,
    authenticated: true,
    name: user.name,
  };

  setStoredAuthUser(authUser);
  setAuthCookie(role);
}

/**
 * Clears both localStorage and cookies.
 */
export function clearAuthSession(): void {
  clearStoredAuthUser();
  clearAuthCookie();
}

/**
 * Fetch user profile from the database 'users' table.
 */
export async function getUserProfile(userId: string) {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch user profile:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Error fetching user profile:', err);
    return null;
  }
}

/**
 * Resolves user role from database profile or user metadata.
 */
export async function getUserRole(user: User): Promise<string> {
  // 1. Try public.users table
  const profile = await getUserProfile(user.id);
  if (profile?.role) {
    return profile.role;
  }

  // 2. Try user_metadata in auth.users
  if (user.user_metadata?.role) {
    return user.user_metadata.role as string;
  }

  // 3. Fallback: default to admin
  return 'admin';
}

/**
 * Sign in with email and password via Supabase Auth (or development fallback if Supabase not configured).
 */
export async function signInWithPassword({ email, password }: SignInCredentials): Promise<AuthResult> {
  const cleanEmail = email.trim();

  // If Supabase is configured with real credentials, perform Supabase auth
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      return {
        user: null,
        session: null,
        role: '',
        error: new Error(error.message),
        errorDetail: error.message || 'Invalid login credentials.',
      };
    }

    if (!data.user) {
      return {
        user: null,
        session: null,
        role: '',
        error: new Error('User not found in session.'),
        errorDetail: 'Authentication succeeded but no user data was returned.',
      };
    }

    const role = await getUserRole(data.user);

    // Save session in localStorage and cookie
    setAuthSession({
      id: data.user.id,
      email: cleanEmail,
      role,
      name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
    });

    return {
      user: data.user,
      session: data.session,
      role,
      error: null,
    };
  }

  // Supabase not configured: allow development/demo login based on email
  let role = 'admin';
  if (cleanEmail.toLowerCase().includes('staff')) {
    role = 'staff';
  } else if (cleanEmail.toLowerCase().includes('manager')) {
    role = 'manager';
  } else {
    role = 'admin';
  }

  const mockUser = {
    id: 'demo-admin-id',
    email: cleanEmail,
    role,
    name: cleanEmail.split('@')[0],
  };

  setAuthSession(mockUser);

  return {
    user: mockUser as unknown as User,
    session: null,
    role,
    error: null,
  };
}

/**
 * Sign out user from Supabase and clear all local session state.
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase signOut error:', error.message);
      }
    }
  } catch (err) {
    console.warn('SignOut exception:', err);
  } finally {
    clearAuthSession();
  }

  return { error: null };
}

/**
 * Get current active Supabase session.
 */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('getSession error:', error.message);
      return null;
    }
    return data.session;
  } catch (err) {
    console.warn('getSession exception:', err);
    return null;
  }
}

/**
 * Get current authenticated user from Supabase.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('getCurrentUser error:', error.message);
      return null;
    }
    return data.user;
  } catch (err) {
    console.warn('getCurrentUser exception:', err);
    return null;
  }
}

/**
 * Listen to auth state changes from Supabase.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  if (!isSupabaseConfigured) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Request a password reset email.
 */
export async function resetPasswordForEmail(email: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  return supabase.auth.resetPasswordForEmail(email.trim());
}

/**
 * Update current user password.
 */
export async function updateUserPassword(newPassword: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }
  return supabase.auth.updateUser({ password: newPassword });
}
