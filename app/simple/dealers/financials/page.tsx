'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SimpleHeader from '@/components/simple/header';
import SimpleSidebar from '@/components/simple/sidebar';
import AddDealerTransactionModal from '@/components/simple/adddealerTransaction';
import { getSimpleDealerById, SimpleDealer, SimpleDealerBalance } from '@/lib/simple/ndealersStore';
import {
  getSimpleDealerBalances,
  getSimpleDealerTransactions,
  SimpleDealerTransactionRow,
} from '@/lib/simple/ndealersFinanceStore';
import { getSimpleUserProfile } from '@/lib/secretProfile';
import {
  ArrowLeft,
  Users,
  Building2,
  Receipt,
  AlertCircle,
  RefreshCw,
  Plus,
  MessageCircle,
} from 'lucide-react';

function formatCurrency(val: number): string {
  return `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function SimpleDealerFinancialsContent() {
  const searchParams = useSearchParams();
  const dealerId = searchParams.get('id');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [simpleName, setSimpleName] = useState('');
  const [dealer, setDealer] = useState<SimpleDealer | null>(null);
  const [balances, setBalances] = useState<SimpleDealerBalance[]>([]);
  const [transactions, setTransactions] = useState<SimpleDealerTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [taxModeFilter, setTaxModeFilter] = useState<'all' | 'gst' | 'n_gst'>('all');

  const refreshFinanceData = useCallback(async (id: string) => {
    const [balData, txData] = await Promise.all([
      getSimpleDealerBalances(id),
      getSimpleDealerTransactions(id),
    ]);
    setBalances(balData);
    setTransactions(txData);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const profile = await getSimpleUserProfile();
      if (profile?.name) {
        setSimpleName(profile.name);
      } else if (profile?.email) {
        const prefix = profile.email.split('@')[0];
        setSimpleName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      if (!dealerId) {
        setError('No dealer ID provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      const [dlrData, balData, txData] = await Promise.all([
        getSimpleDealerById(dealerId),
        getSimpleDealerBalances(dealerId),
        getSimpleDealerTransactions(dealerId),
      ]);

      if (!dlrData) {
        setError('Dealer not found.');
        setLoading(false);
        return;
      }

      setDealer(dlrData);
      setBalances(balData);
      setTransactions(txData);
      setLoading(false);
    };

    loadData();
  }, [dealerId]);

  const totalNGstBalance = balances.reduce(
    (sum, b) => sum + Number(b.n_gst_balance || 0),
    0
  );

  const whatsappPhone = formatWhatsAppPhone(dealer?.phone);

  const filteredTransactions =
    taxModeFilter === 'all'
      ? transactions
      : transactions.filter((tx) => tx.tax_mode === taxModeFilter);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      <SimpleHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        simpleName={simpleName}
      />

      <div className="flex flex-1 w-full relative">
        <SimpleSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top Navigation & Add Transaction Button */}
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/simple/dealers"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dealers</span>
              </Link>

              {dealer && (
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
                <span>Loading dealer financials...</span>
              </div>
            ) : !dealer ? (
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-danger-text)]">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[var(--color-danger)]" />
                <p className="font-semibold">{error || 'Dealer could not be found.'}</p>
                <Link
                  href="/simple/dealers"
                  className="btn btn-outline btn-sm mt-4 inline-flex"
                >
                  Return to Dealers
                </Link>
              </div>
            ) : (
              <>
                {/* Dealer Header Summary Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                          {dealer.name}
                        </h1>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                        {dealer.phone ? `Mobile: ${dealer.phone}` : 'No mobile'}
                        {dealer.city ? ` • ${dealer.city}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border-subtle)] text-right">
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      Total N-GST Balance
                    </div>
                    <div className="text-lg font-bold text-[var(--color-brand-deep-green)]">
                      {formatCurrency(totalNGstBalance)}
                    </div>
                  </div>
                </div>

                {/* Firm Dealer Balances Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                          Firm Dealer Balances
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Outstanding balances per firm from firm_dealer_balances.
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
                          <th className="py-3.5 px-4 sm:px-6">Firm</th>
                          <th className="py-3.5 px-4 sm:px-6 text-right">N-GST Balance</th>
                          <th className="py-3.5 px-4 sm:px-6 text-right">GST Balance</th>
                          <th className="py-3.5 px-4 sm:px-6 text-right">Updated At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {balances.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-10 text-center text-[var(--color-text-muted)]">
                              No firm balances recorded for this dealer.
                            </td>
                          </tr>
                        ) : (
                          balances.map((bal, idx) => {
                            const updatedDateText = bal.updated_at
                              ? new Date(bal.updated_at).toLocaleDateString()
                              : '—';
                            const balanceDateForMsg = bal.updated_at
                              ? new Date(bal.updated_at).toLocaleDateString('en-IN')
                              : new Date().toLocaleDateString('en-IN');
                            const balanceMsg = `Hello ${dealer.name},\nDate: ${balanceDateForMsg}\nExisting Balance: ${formatCurrency(bal.n_gst_balance)}`;

                            return (
                              <tr
                                key={bal.id || idx}
                                className="hover:bg-[var(--color-surface-hover)] transition-colors"
                              >
                                <td className="py-3.5 px-4 sm:px-6 font-medium text-[var(--color-text-primary)]">
                                  {bal.firm_name || bal.firm_id}
                                </td>
                                <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold text-[var(--color-brand-deep-green)]">
                                  {formatCurrency(bal.n_gst_balance)}
                                </td>
                                <td className="py-3.5 px-4 sm:px-6 text-right font-mono text-[var(--color-text-secondary)]">
                                  {formatCurrency(bal.gst_balance)}
                                </td>
                                <td className="py-3.5 px-4 sm:px-6 text-right text-xs text-[var(--color-text-muted)]">
                                  <div className="inline-flex items-center justify-end gap-2">
                                    <span>{updatedDateText}</span>
                                    {whatsappPhone ? (
                                      <a
                                        href={buildWhatsAppUrl(whatsappPhone, balanceMsg)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Send balance on WhatsApp"
                                        aria-label="Send balance on WhatsApp"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors font-medium"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span>WhatsApp</span>
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled
                                        title="Dealer mobile number not available"
                                        aria-label="Dealer mobile number not available"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed font-medium"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span>WhatsApp</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* All Dealer Transactions Card */}
                <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs overflow-hidden">
                  <div className="p-5 sm:p-6 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                          Dealer Transactions
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          All recorded transactions for this dealer.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-0.5">
                        {(['all', 'gst', 'n_gst'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setTaxModeFilter(mode)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                              taxModeFilter === mode
                                ? 'bg-[var(--color-brand-deep-green)] text-white'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            }`}
                          >
                            {mode === 'all' ? 'All' : mode === 'gst' ? 'GST' : 'N-GST'}
                          </button>
                        ))}
                      </div>
                      <span className="badge badge-primary">
                        {filteredTransactions.length} Transactions
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
                        <tr>
                          <th className="py-3.5 px-4">Transaction Code</th>
                          <th className="py-3.5 px-4">Transaction Type</th>
                          <th className="py-3.5 px-4">Pay Method</th>
                          <th className="py-3.5 px-4">Tax Mode</th>
                          <th className="py-3.5 px-4 text-right">Amount</th>
                          <th className="py-3.5 px-4 text-right">Remaining</th>
                          <th className="py-3.5 px-4">Transaction Date</th>
                          <th className="py-3.5 px-4">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-[var(--color-text-muted)]">
                              No transactions recorded for this dealer.
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((tx) => {
                            const remainingText =
                              tx.remaining_balance !== null && tx.remaining_balance !== undefined
                                ? formatCurrency(tx.remaining_balance)
                                : '—';
                            const txTypeFormatted = tx.transaction_type
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            const txMsg = `Hello ${dealer.name},\nDate: ${tx.transaction_date}\nType: ${txTypeFormatted}\nAmount: ${formatCurrency(tx.amount)}\nNew Balance: ${
                              tx.remaining_balance !== null && tx.remaining_balance !== undefined
                                ? formatCurrency(tx.remaining_balance)
                                : 'N/A'
                            }`;

                            return (
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
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded bg-[var(--color-background)] border border-[var(--color-border)] font-mono text-xs text-[var(--color-text-primary)]">
                                    {tx.tax_mode}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                                  {formatCurrency(tx.amount)}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    <span>{remainingText}</span>
                                    {whatsappPhone ? (
                                      <a
                                        href={buildWhatsAppUrl(whatsappPhone, txMsg)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Send transaction details on WhatsApp"
                                        aria-label="Send transaction details on WhatsApp"
                                        className="inline-flex items-center justify-center p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled
                                        title="Dealer mobile number not available"
                                        aria-label="Dealer mobile number not available"
                                        className="inline-flex items-center justify-center p-1 rounded bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-[var(--color-text-secondary)] whitespace-nowrap">
                                  {tx.transaction_date}
                                </td>
                                <td className="py-3.5 px-4 text-[var(--color-text-secondary)] max-w-xs">
                                  {tx.notes || '—'}
                                </td>
                              </tr>
                            );
                          })
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

      {dealer && (
        <AddDealerTransactionModal
          dealerId={dealer.id}
          dealerName={dealer.name}
          isOpen={isAddTxModalOpen}
          onClose={() => setIsAddTxModalOpen(false)}
          onTransactionAdded={() => refreshFinanceData(dealer.id)}
        />
      )}
    </div>
  );
}

export default function SimpleDealerFinancialsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] text-[var(--color-text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-brand-deep-green)]" />
        </div>
      }
    >
      <SimpleDealerFinancialsContent />
    </Suspense>
  );
}
