'use client';

import Image from 'next/image';
import { Menu, X, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  adminName?: string;
}

export default function AdminHeader({
  isSidebarOpen,
  onToggleSidebar,
  adminName = 'Admin',
}: HeaderProps) {
  const handleLogout = async () => {
    await signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-40 w-full h-16 bg-[var(--color-brand-white)] border-b border-[var(--color-border)] shadow-xs flex items-center justify-between px-4 sm:px-6">
      {/* Left: Sidebar Toggle Button (Non-desktop screens) + Logo + Sridevi Traders Bold Heading */}
      <div className="flex items-center gap-3">
        {/* Toggle Button for screens except desktop (hidden on desktop 'lg:' where sidebar sticks) */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus:outline-none lg:hidden cursor-pointer"
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Brand Logo */}
        <div className="flex items-center shrink-0">
          <Image
            src="/st&co_logo.png"
            alt="Sridevi Traders Logo"
            width={36}
            height={36}
            priority
            className="h-9 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Brand Name with Bold Heading */}
        <h1 className="font-bold text-base sm:text-xl text-[var(--color-brand-deep-green)] tracking-tight whitespace-nowrap">
          Sridevi Traders
        </h1>
      </div>

      {/* Center: Hello Admin name */}
      <div className="text-center px-2">
        <span className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
          Hello {adminName}
        </span>
      </div>

      {/* Right: Logout button */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors focus:outline-none cursor-pointer"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
