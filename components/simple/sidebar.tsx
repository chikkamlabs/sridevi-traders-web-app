'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ShoppingCart,
  TrendingUp,
  Users,
  Truck,
  X,
} from 'lucide-react';

interface SimpleSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { name: 'Home', href: '/simple/dashboard', icon: Home },
  { name: 'Purchases', href: '/simple/purchases', icon: ShoppingCart },
  { name: 'Sales', href: '/simple/sales', icon: TrendingUp },
  { name: 'Dealers', href: '/simple/dealers', icon: Users },
  { name: 'Suppliers', href: '/simple/suppliers', icon: Truck },
];

export default function SimpleSidebar({ isOpen, onClose }: SimpleSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop Overlay for non-desktop (closes sidebar on tap) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden transition-opacity cursor-pointer"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: sticks on desktop, drawer on other screen sizes */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-64 bg-[var(--color-brand-white)] border-r border-[var(--color-border)] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:shrink-0 ${
          isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
        aria-label="Simple Sidebar"
      >
        {/* Header for non-desktop screens with close button on tap */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] lg:hidden">
          <span className="font-semibold text-sm text-[var(--color-text-secondary)]">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] focus:outline-none cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.name === 'Home'
                ? pathname === '/simple/dashboard'
                : item.href !== '/simple/dashboard' && pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-brand-light-green)] hover:text-[var(--color-brand-deep-green)]'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-[var(--color-brand-deep-green)]' : 'text-[var(--color-text-secondary)]'
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
