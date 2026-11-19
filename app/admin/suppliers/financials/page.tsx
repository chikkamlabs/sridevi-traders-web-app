'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import AddSupplierTransactionModal from '@/components/admin/addsupplierTransaction';
import { getSupplierById, Supplier } from '@/lib/suppliersStore';
import {
  getSupplierGstBalances,
  getSupplierGstTransactions,
  type SupplierFirmGstBalance,
  type SupplierTransactionRow,
} from '@/lib/suppliertrasacationsStore';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  Truck,
  Building2,
  Receipt,
  AlertCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';

function formatCurrency(val: number): string {
  return `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function AdminSupplierFinancialsContent() {
  const searchParams = useSearchParams();
  const supplierId = searchParams.get('id');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [balances, setBalances] = useState<SupplierFirmGstBalance[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);

  const refreshFinanceData = useCallback(async (id: string) => {
    const [balData, txData] = await Promise.all([
      getSupplierGstBalances(id),
      getSupplierGstTransactions(id),
    ]);
    setBalances(balData);
    setTransactions(txData);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const prefix = user.email.split('@')[0];
        setAdminName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      if (!supplierId) {
        setError('No supplier ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const [supData, balData, txData] = await Promise.all([
        getSupplierById(supplierId),
        getSupplierGstBalances(supplierId),
        getSupplierGstTransactions(supplierId),
      ]);

      if (!supData) {
        setError('Supplier not found.');
        setLoading(false);
        return;
      }

      setSupplier(supData);
      setBalances(balData);
      setTransactions(txData);
      setLoading(false);
    };

    loadData();
  }, [supplierId]);

  const totalGstBalance = balances.reduce(
    (sum, b) => sum + Number(b.gst_balance || 0),
    0
  );

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
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Back link & Add Transaction Button */}
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/admin/suppliers"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Suppliers</span>
              </Link>

              {supplier && (
                <button
                  type="button"
                  onClick={() => setIsAddTxModalOpen(true)}
                  className="btn btn-primary btn-sm inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Transaction</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-12 text-center text-[var(--color-text-muted)]">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[var(--color-brand-deep-green)]" />
                <span>Loading supplier financials...</span>
              </div>
            ) : !supplier ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-danger-text)]">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[var(--color-danger)]" />
                <p className="font-semibold">{error || 'Supplier could not be found.'}</p>
                <Link
                  href="/admin/suppliers"
                  className="btn btn-outline btn-sm mt-4 inline-flex"
                >
                  Return to Suppliers
                </Link>
              </div>
            ) : (
              <>
                {/* Supplier Header Summary Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                          {supplier.name}
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-xs font-semibold text-[var(--color-brand-deep-green)]">
                          {supplier.supplier_code}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                        {supplier.phone ? `Mobile: ${supplier.phone}` : 'No mobile'}
                        {supplier.city ? ` • ${supplier.city}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] text-right">
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      Total GST Balance
                    </div>
                    <div className="text-lg font-bold text-[var(--color-brand-deep-green)]">
                      {formatCurrency(totalGstBalance)}
                    </div>
                  </div>
                </div>

                {/* Firm Supplier Balances Card (firm name, balance(Only gst_balance)) */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                          Firm Supplier Balances
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Outstanding GST balances per firm.
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-primary">
                      {balances.length} Firms
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                        <tr>
                          <th className="py-3.5 px-4 sm:px-6">Firm Name</th>
                          <th className="py-3.5 px-4 sm:px-6 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {balances.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="py-10 text-center text-[var(--color-text-muted)]">
                              No firm balances recorded for this supplier.
                            </td>
                          </tr>
                        ) : (
                          balances.map((bal, idx) => (
                            <tr
                              key={bal.id || idx}
                              className="hover:bg-[var(--color-surface-hover)] transition-colors"
                            >
                              <td className="py-3.5 px-4 sm:px-6 font-medium text-[var(--color-text-primary)]">
                                {bal.firm_name || bal.firm_id}
                              </td>
                              <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold text-[var(--color-brand-deep-green)]">
                                {formatCurrency(bal.gst_balance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Supplier Transactions Card (tax_mode = gst) */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                          Supplier Transactions
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Recorded GST transactions for this supplier.
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-primary">
                      {transactions.length} Transactions
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                        <tr>
                          <th className="py-3.5 px-4">Transaction Code</th>
                          <th className="py-3.5 px-4">Transaction Type</th>
                          <th className="py-3.5 px-4">Pay Method</th>
                          <th className="py-3.5 px-4 text-right">Amount</th>
                          <th className="py-3.5 px-4">Transaction Date</th>
                          <th className="py-3.5 px-4">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {transactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-[var(--color-text-muted)]">
                              No transactions recorded for this supplier.
                            </td>
                          </tr>
                        ) : (
                          transactions.map((tx) => (
                            <tr
                              key={tx.id}
                              className="hover:bg-[var(--color-surface-hover)] transition-colors"
                            >
                              <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[var(--color-brand-deep-green)] whitespace-nowrap">
                                {tx.transaction_code}
                              </td>
                              <td className="py-3.5 px-4 capitalize text-[var(--color-text-primary)] whitespace-nowrap">
                                {tx.transaction_type.replace('_', ' ')}
                              </td>
                              <td className="py-3.5 px-4 uppercase text-[var(--color-text-secondary)] whitespace-nowrap">
                                {tx.payment_method}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                                {formatCurrency(tx.amount)}
                              </td>
                              <td className="py-3.5 px-4 text-[var(--color-text-secondary)] whitespace-nowrap">
                                {tx.transaction_date}
                              </td>
                              <td className="py-3.5 px-4 text-[var(--color-text-secondary)] max-w-xs">
                                {tx.notes || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {supplier && (
        <AddSupplierTransactionModal
          supplierId={supplier.id}
          supplierName={supplier.name}
          isOpen={isAddTxModalOpen}
          onClose={() => setIsAddTxModalOpen(false)}
          onTransactionAdded={() => refreshFinanceData(supplier.id)}
        />
      )}
    </div>
  );
}

export default function AdminSupplierFinancialsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-brand-deep-green)]" />
        </div>
      }
    >
      <AdminSupplierFinancialsContent />
    </Suspense>
  );
}
