import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface AdminDashboardStats {
  totalPurchasesThisWeek: number;
  totalSalesThisWeek: number;
  totalProducts: number;
  weekFromDate: string;
  weekToDate: string;
}

function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getThisWeekDateRange(): { fromDate: string; toDate: string } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  return {
    fromDate: formatDateYMD(monday),
    toDate: formatDateYMD(today),
  };
}

/**
 * Fetch Total Purchases (This week), Total Sales (This week), and Total Products count.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { fromDate, toDate } = getThisWeekDateRange();

  if (isSupabaseConfigured) {
    try {
      const [purchasesRes, salesRes, productsRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .gte('date', fromDate)
          .lte('date', toDate),
        supabase
          .from('sales_bills')
          .select('id', { count: 'exact', head: true })
          .gte('date', fromDate)
          .lte('date', toDate),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true }),
      ]);

      return {
        totalPurchasesThisWeek: purchasesRes.count ?? 0,
        totalSalesThisWeek: salesRes.count ?? 0,
        totalProducts: productsRes.count ?? 0,
        weekFromDate: fromDate,
        weekToDate: toDate,
      };
    } catch (err) {
      console.warn('Error fetching admin dashboard stats from Supabase:', err);
    }
  }

  // Local fallback
  let localPurchasesCount = 0;
  let localSalesCount = 0;
  let localProductsCount = 0;

  if (typeof window !== 'undefined') {
    try {
      const rawPurchases = localStorage.getItem('st_purchases_cache');
      if (rawPurchases) {
        const list = JSON.parse(rawPurchases) as Array<{ date: string }>;
        localPurchasesCount = list.filter(
          (p) => p.date >= fromDate && p.date <= toDate
        ).length;
      }

      const rawSales = localStorage.getItem('st_sales_bills_cache');
      if (rawSales) {
        const list = JSON.parse(rawSales) as Array<{ date: string }>;
        localSalesCount = list.filter(
          (s) => s.date >= fromDate && s.date <= toDate
        ).length;
      }

      const rawProducts = localStorage.getItem('st_products_cache');
      if (rawProducts) {
        const list = JSON.parse(rawProducts) as unknown[];
        localProductsCount = list.length;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return {
    totalPurchasesThisWeek: localPurchasesCount,
    totalSalesThisWeek: localSalesCount,
    totalProducts: localProductsCount,
    weekFromDate: fromDate,
    weekToDate: toDate,
  };
}
