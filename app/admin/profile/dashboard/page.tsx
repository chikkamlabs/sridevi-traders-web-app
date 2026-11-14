'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import {
  getAdminProfile,
  changeAdminPassword,
  logoutAdmin,
  AdminProfile,
} from '@/lib/profileStore';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  KeyRound,
  LogOut,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';

export default function ProfileDashboardPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const keyTapCountRef = useRef(0);
  const keyTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Change Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data, error: fetchErr } = await getAdminProfile();
      if (!active) return;

      if (data) {
        setProfile(data);
      } else if (fetchErr) {
        setError(fetchErr);
      }
      setLoading(false);
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleRequestPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    // Ask confirmation before editing
    setIsConfirmModalOpen(true);
  };

  const handleConfirmPasswordChange = async () => {
    setIsConfirmModalOpen(false);
    setIsUpdatingPassword(true);
    setError(null);
    setSuccessMsg(null);

    const { success, error: updateErr } = await changeAdminPassword(newPassword);

    if (!success) {
      setError(updateErr || 'Failed to update password.');
      setIsUpdatingPassword(false);
      return;
    }

    setSuccessMsg('Password updated successfully!');
    setNewPassword('');
    setConfirmPassword('');
    setIsUpdatingPassword(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutAdmin();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const handleKeyIconTap = () => {
    keyTapCountRef.current += 1;

    if (keyTapTimerRef.current) {
      clearTimeout(keyTapTimerRef.current);
    }

    if (keyTapCountRef.current >= 3) {
      keyTapCountRef.current = 0;
      router.push('/admin/profile/secretkey');
      return;
    }

    keyTapTimerRef.current = setTimeout(() => {
      keyTapCountRef.current = 0;
    }, 2000);
  };

  const adminDisplayName =
    profile?.name ||
    (profile?.email ? profile.email.split('@')[0] : 'Admin');

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminDisplayName}
      />

      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--color-brand-white)] p-5 rounded-xl border border-[var(--color-border)] shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="page-title text-xl sm:text-2xl text-[var(--color-text-primary)]">
                    Profile
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    View your account details, update your password, or sign out.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="btn btn-danger inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="p-4 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-danger)]" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2.5 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--color-brand-deep-green)]" />
                <span>{successMsg}</span>
              </div>
            )}

            {loading ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-12 text-center text-[var(--color-text-muted)]">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[var(--color-brand-deep-green)]" />
                <span>Loading profile details...</span>
              </div>
            ) : (
              <>
                {/* Profile Details Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                      Profile Details
                    </h2>
                    <span
                      className={`status-chip ${
                        profile?.status !== false
                          ? 'status-chip-active'
                          : 'status-chip-danger'
                      }`}
                    >
                      {profile?.status !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <User className="w-3.5 h-3.5" />
                        <span>Full Name</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {profile?.name || '—'}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email Address</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {profile?.email || '—'}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Phone</span>
                      </div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {profile?.phone || 'Not set'}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-[var(--color-background)] border border-[var(--color-border-subtle)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Role</span>
                      </div>
                      <div className="text-sm font-semibold uppercase text-[var(--color-brand-deep-green)]">
                        {profile?.role || 'admin'}
                      </div>
                    </div>
                  </div>

                  {profile?.created_at && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] pt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Member since {new Date(profile.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Change Password Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-5">
                  <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
                    <button
                      type="button"
                      onClick={handleKeyIconTap}
                      className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] cursor-pointer focus:outline-none"
                      aria-label="Change Password Key"
                    >
                      <KeyRound className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                        Change Password
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Enter a new password. Confirmation will be requested before applying the change.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleRequestPasswordChange} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="form-group mb-0">
                        <label htmlFor="new-password" className="form-label">
                          New Password <span className="text-[var(--color-danger)]">*</span>
                        </label>
                        <input
                          id="new-password"
                          type="password"
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="input-field text-sm"
                          disabled={isUpdatingPassword}
                        />
                      </div>

                      <div className="form-group mb-0">
                        <label htmlFor="confirm-password" className="form-label">
                          Confirm New Password <span className="text-[var(--color-danger)]">*</span>
                        </label>
                        <input
                          id="confirm-password"
                          type="password"
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="input-field text-sm"
                          disabled={isUpdatingPassword}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingPassword}
                        className="btn btn-primary min-w-[160px]"
                      >
                        {isUpdatingPassword ? 'Updating...' : 'Change Password'}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Confirmation Dialog before editing password */}
      {isConfirmModalOpen && (
        <div className="dialog-overlay animate-fade-in" role="dialog" aria-modal="true">
          <div className="dialog-content animate-scale-in">
            <div className="dialog-header">
              <h3 className="dialog-title">Confirm Password Change</h3>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                aria-label="Close confirmation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="dialog-body">
              <p className="body-text">
                Are you sure you want to change your account password? You will need to use the new password on your next sign-in.
              </p>
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPasswordChange}
                className="btn btn-primary"
              >
                Confirm &amp; Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
