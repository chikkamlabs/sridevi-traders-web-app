'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { signInWithPassword } from '@/lib/auth';

interface LoginError {
  title: string;
  detail: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        setError({
          title: 'Missing Credentials',
          detail: 'Please enter both your email address and password.',
        });
        setLoading(false);
        return;
      }

      // Execute authentication via centralized Supabase auth helper
      const result = await signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (result.error) {
        setError({
          title: 'Login Failed',
          detail: result.errorDetail || result.error.message || 'Invalid email or password. Please verify your credentials and try again.',
        });
        setLoading(false);
        return;
      }

      // Check role authorization
      if (result.role !== 'admin') {
        setError({
          title: 'Access Denied',
          detail: `User role "${result.role}" is not authorized. Only admin accounts can access the admin dashboard.`,
        });
        setLoading(false);
        return;
      }

      // Navigate to admin dashboard with query bridge for reliable authorization & cookie persistence
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/dashboard?auth=admin';
      }
    } catch (err: unknown) {
      const detailMsg = err instanceof Error ? err.message : 'An unexpected error occurred during authentication.';
      setError({
        title: 'Authentication Error',
        detail: detailMsg,
      });
      setLoading(false);
    }
  };

  return (
    <main className="main-page-container flex-center p-4 min-h-screen" >
      <div className="card w-full max-w-md shadow-lg border border-[var(--color-border)]" >
        <div className="card-body p-8 flex flex-col items-center" >
          {/* SriDevi Traders Logo */}
          <div className="mb-4 flex items-center justify-center" >
            <Image
              src="/st&co_logo.png"
              alt="SriDevi Traders Logo"
              width={140}
              height={140}
              priority
              
              className="h-24 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Heading */}
          <h1 className="page-title text-center mb-6" >
            Welcome to SriDevi Traders
          </h1>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4" >
            {/* Error Message with Detail Line */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3.5 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] flex flex-col gap-1 text-sm animate-fade-in"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger)]" />
                  <span>{error.title}</span>
                </div>
                <div className="pl-6 text-xs text-[var(--color-danger-text)] leading-relaxed break-words font-normal">
                  <span className="font-medium">Detail: </span>
                  {error.detail}
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="form-group mb-0" >
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="input-field"
                autoComplete="email"
                disabled={loading}
                
              />
            </div>

            {/* Password Field with View Toggle */}
            <div className="form-group mb-0" >
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative flex items-center" >
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-11"
                  autoComplete="current-password"
                  disabled={loading}
                  
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'View password'}
                  title={showPassword ? 'Hide password' : 'View password'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Eye className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5 mt-2 font-medium flex items-center justify-center gap-2"
              
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
