'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CreditCard, Download, RefreshCw, Search, TrendingUp, X } from 'lucide-react';

type Range = '7d' | '30d' | '90d';

interface PlanRow {
  id: string;
  name: string;
  priceCents: number;
  userCount: number;
  requestsPerDay: number;
  requestsPerMinute: number;
  requestsPerMonth: number;
}

interface InvoiceRow {
  id: string;
  invoiceId: string;
  customerEmail: string;
  customerName: string | null;
  customerId: string;
  planId: string | null;
  planName: string;
  amountCents: number;
  status: string;
  createdAt: string;
  stripePaymentId: string | null;
}

interface FailedPaymentRow {
  id: string;
  customerEmail: string;
  customerName: string | null;
  amountCents: number;
  status: string;
  createdAt: string;
  planId: string | null;
}

interface BillingCustomerRow {
  id: string;
  email: string;
  name: string | null;
  plan: {
    id: string;
    name: string;
    priceCents: number;
    requestsPerDay: number;
    requestsPerMinute: number;
    requestsPerMonth: number;
  };
  stripeCustomerId: string | null;
  lastPaymentAt: string | null;
  hasFailedPayment: boolean;
  totalPaidCents: number;
}

interface BillingAdjustmentRow {
  id: string;
  userId: string;
  customerEmail: string;
  customerName: string | null;
  type: string;
  amountCents: number;
  reason: string;
  status: string;
  actor: string;
  createdAt: string;
}

interface BillingData {
  range: string;
  summary: {
    totalRevenueCents: number;
    monthlyRevenueCents: number;
    mrrCents: number;
    activeCustomers: number;
    totalCustomers: number;
    completedPayments: number;
    failedPayments: number;
    pendingPayments: number;
    monthlyPayments: number;
    pastDueCustomers: number;
    creditCents: number;
    refundCents: number;
    adjustmentCount: number;
  };
  plans: PlanRow[];
  recentInvoices: InvoiceRow[];
  failedPayments: FailedPaymentRow[];
  customerBilling: BillingCustomerRow[];
  adjustments: BillingAdjustmentRow[];
}

const RANGE_OPTIONS: Range[] = ['7d', '30d', '90d', 'all'];

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function money(num: number) {
  return num.toLocaleString();
}

function timeAgo(value: string, now: number) {
  const seconds = Math.floor((now - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function statusBadge(status: string) {
  if (status === 'succeeded' || status === 'completed') return 'badge-success';
  if (status === 'failed' || status === 'canceled') return 'badge-danger';
  return 'badge-warning';
}

export default function AdminBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('25');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const fetchData = useCallback(async (selectedRange: Range = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/billing?range=${selectedRange}`);
      if (!res.ok) {
        setError('Failed to load billing');
        return;
      }
      setData(await res.json());
      setError('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData(range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [range, fetchData]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.recentInvoices || [];
    return (data?.recentInvoices || []).filter((invoice) =>
      invoice.customerEmail.toLowerCase().includes(q) ||
      invoice.planName.toLowerCase().includes(q) ||
      invoice.invoiceId.toLowerCase().includes(q) ||
      invoice.status.toLowerCase().includes(q)
    );
  }, [data, search]);

  const selectedCustomer = useMemo(
    () => selectedInvoice ? data?.customerBilling.find((customer) => customer.id === selectedInvoice.customerId) || null : null,
    [data, selectedInvoice]
  );

  const adjustmentSummary = useMemo(() => ({
    creditCents: data?.adjustments.filter((adjustment) => adjustment.type === 'credit').reduce((sum, adjustment) => sum + adjustment.amountCents, 0) || 0,
    refundCents: data?.adjustments.filter((adjustment) => adjustment.type === 'refund').reduce((sum, adjustment) => sum + adjustment.amountCents, 0) || 0,
  }), [data]);

  function downloadCsv() {
    const rows = filteredInvoices.map((invoice) => [
      invoice.invoiceId,
      invoice.customerEmail,
      invoice.customerName || '',
      invoice.planName,
      invoice.status,
      invoice.amountCents / 100,
      invoice.createdAt,
      invoice.stripePaymentId || '',
    ]);
    const header = ['invoice_id', 'customer_email', 'customer_name', 'plan_name', 'status', 'amount_usd', 'created_at', 'stripe_payment_id'];
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-ledger-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitAdjustment(action: 'credit' | 'refund') {
    if (!selectedInvoice) return;
    const amount = Number(adjustmentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setActionLoading(action);
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          userId: selectedInvoice.customerId,
          amountCents: Math.round(amount * 100),
          reason: adjustmentReason || `${action} for ${selectedInvoice.invoiceId}`,
        }),
      });
      if (!res.ok) {
        setError('Failed to save billing adjustment');
        return;
      }
      setAdjustmentReason('');
      void fetchData(range);
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="min-h-[calc(100vh-44px)] flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading billing data…</p>
        </div>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="max-w-[1480px] mx-auto px-6 py-8">
        <div className="glass-card p-6 mb-8 border border-[rgba(16,185,129,0.18)] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(16,185,129,0.18), transparent 36%)' }} />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.12)] text-[rgb(74,222,128)] text-xs font-semibold uppercase tracking-wider mb-4 border border-[rgba(16,185,129,0.2)]">
                Billing Operations
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-3">
                Track revenue, subscriptions, invoices, and payment risk from one place.
              </h1>
              <p className="text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
                This page gives the owner a live view into revenue, monthly recurring revenue, payment failures, and invoice history.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setRange(option)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === option ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                  style={range === option ? { background: 'linear-gradient(135deg, #10b981, #6366f1)' } : { background: 'var(--color-bg-card)' }}
                >
                  {option.toUpperCase()}
                </button>
              ))}
              <button onClick={() => void fetchData(range)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
              <Link href="/admin/users" className="btn-secondary text-xs py-1.5 px-3">Accounts</Link>
              <button onClick={downloadCsv} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-2">
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
            {[
              { label: 'MRR', value: fmt(s.mrrCents), sub: `${s.activeCustomers} active customers`, color: '#10b981' },
              { label: 'Revenue', value: fmt(s.totalRevenueCents), sub: `${money(s.monthlyPayments)} payments`, color: '#6366f1' },
              { label: 'Monthly Rev', value: fmt(s.monthlyRevenueCents), sub: `range ${data.range.toUpperCase()}`, color: '#8b5cf6' },
              { label: 'Customers', value: money(s.totalCustomers), sub: `${s.pastDueCustomers} past due`, color: '#f59e0b' },
              { label: 'Completed', value: money(s.completedPayments), sub: 'successful payments', color: '#22c55e' },
              { label: 'Failed', value: money(s.failedPayments), sub: 'payment failures', color: '#ef4444' },
              { label: 'Pending', value: money(s.pendingPayments), sub: 'pending invoices', color: '#f97316' },
              { label: 'Txn', value: money(s.monthlyPayments), sub: 'in current window', color: '#ec4899' },
              { label: 'Credits', value: fmt(adjustmentSummary.creditCents), sub: `${s.adjustmentCount} adjustments`, color: '#06b6d4' },
              { label: 'Refunds', value: fmt(adjustmentSummary.refundCents), sub: 'manual billing changes', color: '#f43f5e' },
            ].map((card, index) => (
            <div key={card.label} className="stat-card" style={{ animationDelay: `${index * 0.04}s` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-muted)] text-xs font-medium">{card.label}</span>
                <span className="text-base" style={{ color: card.color }}>●</span>
              </div>
              <div className="stat-value text-2xl">{card.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1.25fr_0.75fr] gap-6 mb-8">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-[var(--color-border)] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Invoice Ledger</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Recent invoice-equivalent payments and subscription activity.</p>
              </div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  className="input-field text-sm py-2 pl-9 w-full sm:w-80"
                  placeholder="Search customer, invoice, plan, or status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                    <th className="px-6 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-medium">{invoice.invoiceId}</div>
                        <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[220px]">{invoice.stripePaymentId || 'No Stripe ref'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium">{invoice.customerName || invoice.customerEmail}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{invoice.customerEmail}</div>
                      </td>
                      <td className="px-4 py-4">{invoice.planName}</td>
                      <td className="px-4 py-4 text-right font-mono">{fmt(invoice.amountCents)}</td>
                      <td className="px-4 py-4 text-center"><span className={statusBadge(invoice.status)}>{invoice.status}</span></td>
                      <td className="px-4 py-4 text-[var(--color-text-muted)]">{timeAgo(invoice.createdAt, now)}</td>
                      <td className="px-4 py-4 text-right">
                        <button
                          className="btn-secondary text-xs py-1.5 px-3"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-semibold">Plan Mix</h2>
                <TrendingUp size={15} className="text-[var(--color-text-muted)]" />
              </div>
              <div className="space-y-3">
                {data.plans.map((plan) => {
                  const share = s.totalCustomers > 0 ? (plan.userCount / s.totalCustomers) * 100 : 0;
                  return (
                    <div key={plan.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-[var(--color-text-muted)]">{plan.userCount} users</span>
                      </div>
                      <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(share, 4)}%`, background: 'linear-gradient(90deg, #10b981, #6366f1)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Past Due Accounts</h2>
              <div className="space-y-3">
                {data.failedPayments.length > 0 ? data.failedPayments.map((payment) => (
                  <div key={payment.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{payment.customerName || payment.customerEmail}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{payment.customerEmail}</div>
                      </div>
                      <span className="badge-danger">{payment.status}</span>
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-text-secondary)] flex items-center justify-between gap-3">
                      <span>{fmt(payment.amountCents)}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{timeAgo(payment.createdAt, now)}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No payment failures in this window.</p>
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Quick Actions</h2>
              <div className="grid gap-3">
                <Link href="/admin/plans" className="btn-secondary inline-flex items-center justify-between">
                  <span>Review pricing</span>
                  <ArrowRight size={15} />
                </Link>
                <button onClick={() => window.location.reload()} className="btn-secondary inline-flex items-center justify-between">
                  <span>Refresh ledger</span>
                  <Download size={15} />
                </button>
                <Link href="/admin/users" className="btn-secondary inline-flex items-center justify-between">
                  <span>Open accounts</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4">Recent Adjustments</h2>
              <div className="space-y-3">
                {data.adjustments.length > 0 ? data.adjustments.slice(0, 5).map((adjustment) => (
                  <div key={adjustment.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{adjustment.customerName || adjustment.customerEmail}</div>
                        <div className="text-xs text-[var(--color-text-muted)] capitalize">{adjustment.type} · {adjustment.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{fmt(adjustment.amountCents)}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{timeAgo(adjustment.createdAt, now)}</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-[var(--color-text-muted)]">No manual credits or refunds yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Customer Billing Snapshot</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Current customer plan assignments and billing risk.</p>
            </div>
            <span className="badge-accent">{data.customerBilling.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)' }}>
                  <th className="px-6 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold text-right">Paid</th>
                  <th className="px-4 py-3 font-semibold text-center">Risk</th>
                  <th className="px-4 py-3 font-semibold">Last Payment</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {data.customerBilling.map((customer) => (
                  <tr key={customer.id} className="border-t border-[rgba(255,255,255,0.03)] hover:bg-[var(--color-bg-card)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{customer.name || customer.email}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{customer.email}</div>
                    </td>
                    <td className="px-4 py-4"><span className={`badge-${customer.plan.priceCents === 0 ? 'warning' : 'accent'}`}>{customer.plan.name}</span></td>
                    <td className="px-4 py-4 text-right font-mono">{fmt(customer.totalPaidCents)}</td>
                    <td className="px-4 py-4 text-center">
                      {customer.hasFailedPayment ? <span className="badge-danger">past due</span> : <span className="badge-success">healthy</span>}
                    </td>
                    <td className="px-4 py-4 text-[var(--color-text-muted)]">{customer.lastPaymentAt ? timeAgo(customer.lastPaymentAt, now) : 'No payments yet'}</td>
                    <td className="px-4 py-4 text-right">
                      <Link href="/admin/users" className="btn-secondary text-xs py-1.5 px-3">View account</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedInvoice && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
            <div className="absolute inset-y-0 right-0 w-full max-w-3xl bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto">
              <div className="p-6 border-b border-[var(--color-border)] sticky top-0 z-10" style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(14px)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                      Invoice Detail
                    </div>
                    <h3 className="text-2xl font-bold">{selectedInvoice.invoiceId}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">{selectedInvoice.customerName || selectedInvoice.customerEmail}</p>
                  </div>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="btn-secondary inline-flex items-center gap-2 text-sm px-3 py-2"
                  >
                    <X size={16} />
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="stat-card">
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Amount</div>
                    <div className="stat-value text-2xl">{fmt(selectedInvoice.amountCents)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Status</div>
                    <div className="stat-value text-2xl capitalize">{selectedInvoice.status}</div>
                  </div>
                </div>

                <div className="glass-card p-5">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Customer Snapshot</h4>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Email</div>
                      <div className="font-semibold break-all">{selectedInvoice.customerEmail}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Plan</div>
                      <div className="font-semibold">{selectedInvoice.planName}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Stripe Payment</div>
                      <div className="font-semibold break-all">{selectedInvoice.stripePaymentId || '—'}</div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: 'var(--color-bg-primary)' }}>
                      <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Last Payment</div>
                      <div className="font-semibold">{selectedCustomer?.lastPaymentAt ? new Date(selectedCustomer.lastPaymentAt).toLocaleDateString() : '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-5">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Manual Adjustment</h4>
                  <div className="grid sm:grid-cols-[1fr_1.5fr] gap-3">
                    <input
                      className="input-field"
                      type="number"
                      min="1"
                      step="0.01"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      placeholder="Amount in USD"
                    />
                    <input
                      className="input-field"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="Reason for credit or refund"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="btn-primary px-4 py-2 inline-flex items-center gap-2"
                      onClick={() => void submitAdjustment('credit')}
                      disabled={actionLoading === 'credit'}
                    >
                      {actionLoading === 'credit' ? 'Saving...' : 'Create Credit'}
                    </button>
                    <button
                      className="btn-secondary px-4 py-2 inline-flex items-center gap-2"
                      onClick={() => void submitAdjustment('refund')}
                      disabled={actionLoading === 'refund'}
                    >
                      {actionLoading === 'refund' ? 'Saving...' : 'Create Refund'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
