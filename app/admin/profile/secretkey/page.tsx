'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getAdminProfile } from '@/lib/profileStore';
import { verifyUserSecretKey } from '@/lib/secretProfile';
import { ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';

export default function SecretKeyPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadAdminName = async () => {
      const { data } = await getAdminProfile();
      if (!active || !data) return;
      if (data.name) {
        setAdminName(data.name);
      } else if (data.email) {
        const emailPrefix = data.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }
    };
    loadAdminName();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { valid, error: verifyErr } = await verifyUserSecretKey(code);

    if (!valid) {
      setError(verifyErr || 'Invalid secret code.');
      setIsSubmitting(false);
      return;
    }

    router.push('/simple/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-md mx-auto space-y-6 pt-4">
            <Link
              href="/admin/profile/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Profile</span>
            </Link>

            <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
                <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Enter Secret Code
                  </h1>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Submit your secret key to continue.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-danger)]" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-group mb-0">
                  <label htmlFor="secret-code" className="form-label">
                    Code <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    id="secret-code"
                    type="password"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter secret code"
                    className="input-field text-sm"
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary w-full"
                >
                  {isSubmitting ? 'Verifying...' : 'Submit'}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
