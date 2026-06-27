'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminPlansPage from './plans-tab';

type Range = '7d' | '30d' | '90d' | 'all';

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

function AdminBillingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ledger';

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
    if (activeTab === 'ledger') {
      const timer = window.setTimeout(() => {
        void fetchData(range);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [range, fetchData, activeTab]);

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

  const handleTabChange = (tabName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabName);
    router.push(`?${params.toString()}`);
  };

  const tabs = [
    { id: 'ledger', label: 'Revenue Ledger' },
    { id: 'plans', label: 'Pricing Plans' }
  ];

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

  const s = data?.summary;

  return (
    <div>
      {/* Tab Switcher */}
      <div className="dash-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`dash-tab ${isActive ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="error-box">
          Error: {error}
        </div>
      )}

      {activeTab === 'ledger' && (
        loading || !data || !s ? (
          <div className="loading-box">
            <div className="auth-spinner" />
          </div>
        ) : (
          <div>
            <div className="dash-page-header flex flex-wrap items-end justify-between gap-20">
              <div>
                <h1 className="dash-page-title">Revenue Ledger</h1>
                <p className="dash-page-sub">
                  Track recurring subscriptions, manual billing credits, past due risks, and invoices.
                </p>
              </div>
              <div className="flex gap-8 flex-wrap">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setRange(option);
                      void fetchData(option);
                    }}
                    className="btn-border text-11 mono"
                    style={{
                      padding: '6px 12px',
                      background: range === option ? 'var(--accent)' : 'transparent',
                      color: range === option ? 'var(--bg)' : 'var(--text)',
                      borderColor: range === option ? 'var(--accent)' : 'var(--border-bright)'
                    }}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
                <button
                  onClick={() => void fetchData(range)}
                  className="btn-border text-11 mono"
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    color: 'var(--text)',
                    borderColor: 'var(--border-bright)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
                <button
                  onClick={downloadCsv}
                  className="btn-border text-11 mono"
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    color: 'var(--text)',
                    borderColor: 'var(--border-bright)'
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Stat cards grid */}
            <div className="dash-stats-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {[
                { label: 'MRR', value: fmt(s.mrrCents), sub: `${s.activeCustomers} active clients`, color: 'var(--accent)' },
                { label: 'Revenue', value: fmt(s.totalRevenueCents), sub: `${money(s.monthlyPayments)} payments`, color: 'var(--text)' },
                { label: 'Monthly Rev', value: fmt(s.monthlyRevenueCents), sub: `range: ${data.range.toUpperCase()}`, color: 'var(--text)' },
                { label: 'Customers', value: money(s.totalCustomers), sub: `${s.pastDueCustomers} past due`, color: 'var(--muted)' },
                { label: 'Completed', value: money(s.completedPayments), sub: 'successful txns', color: 'var(--accent)' },
                { label: 'Failed', value: money(s.failedPayments), sub: 'payment failures', color: 'var(--muted)' },
                { label: 'Pending', value: money(s.pendingPayments), sub: 'open invoices', color: 'var(--muted)' },
                { label: 'Credits', value: fmt(adjustmentSummary.creditCents), sub: `${s.adjustmentCount} adjustments`, color: 'var(--muted)' },
              ].map((card) => (
                <div key={card.label} className="dash-stat">
                  <div className="dash-stat-label">
                    <span>{card.label}</span>
                    <span style={{ color: card.color }}>●</span>
                  </div>
                  <div className="dash-stat-value" style={{ fontSize: '18px' }}>{card.value}</div>
                  <div className="dash-stat-sub">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Main Ledger Area */}
            <div className="dash-grid-2 mb-24">
              <div className="dash-card" style={{ marginBottom: 0, overflowX: 'auto' }}>
                <div className="dash-card-title flex-between flex-wrap gap-12">
                  <span>Invoice Ledger</span>
                  <div className="flex-center gap-8">
                    <Search size={14} className="text-muted" />
                    <input
                      type="text"
                      className="input-field text-11 mono"
                      style={{
                        padding: '6px 12px',
                        width: '200px'
                      }}
                      placeholder="Filter ledger..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Customer</th>
                      <th>Plan</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Status</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="mono">
                          <div className="font-600">{invoice.invoiceId}</div>
                          <div className="text-muted" style={{ fontSize: '9px', marginTop: '2px' }}>{invoice.stripePaymentId || 'no-stripe-ref'}</div>
                        </td>
                        <td>
                          <div className="font-600">{invoice.customerName || '—'}</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>{invoice.customerEmail}</div>
                        </td>
                        <td className="text-12">{invoice.planName}</td>
                        <td className="text-right mono font-600">
                          {fmt(invoice.amountCents)}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${statusBadge(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="footnote">
                          {timeAgo(invoice.createdAt, now)}
                        </td>
                        <td className="text-right">
                          <button
                            className="btn-border mono"
                            style={{ padding: '4px 10px', fontSize: '10px' }}
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

              <div className="dash-stack" style={{ gap: '24px' }}>
                {/* Plan Distribution */}
                <div className="dash-card" style={{ marginBottom: 0 }}>
                  <div className="dash-card-title">Pricing plan shares</div>
                  <div className="dash-stack" style={{ gap: '12px' }}>
                    {data.plans.map((plan) => {
                      const share = s.totalCustomers > 0 ? (plan.userCount / s.totalCustomers) * 100 : 0;
                      return (
                        <div key={plan.id} className="card" style={{ padding: '12px' }}>
                          <div className="flex-between" style={{ marginBottom: '6px' }}>
                            <span className="font-600">{plan.name}</span>
                            <span className="footnote">{plan.userCount} users</span>
                          </div>
                          <div style={{ height: '4px', background: 'var(--border-bright)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--accent)', width: `${Math.max(share, 4)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Past Due Accounts */}
                <div className="dash-card" style={{ marginBottom: 0 }}>
                  <div className="dash-card-title">Past Due Risks</div>
                  <div className="dash-stack" style={{ gap: '10px' }}>
                    {data.failedPayments.length > 0 ? data.failedPayments.map((payment) => (
                      <div key={payment.id} style={{ border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', padding: '12px' }}>
                        <div className="flex-start justify-between" style={{ gap: '8px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div className="font-600 text-12" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payment.customerName || payment.customerEmail}</div>
                            <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>{payment.customerEmail}</div>
                          </div>
                          <span className="badge badge-danger" style={{ fontSize: '8px' }}>{payment.status}</span>
                        </div>
                        <div className="flex-between text-11 mono" style={{ marginTop: '8px' }}>
                          <span className="font-700">{fmt(payment.amountCents)}</span>
                          <span className="text-muted">{timeAgo(payment.createdAt, now)}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="footnote">No active payment failures.</div>
                    )}
                  </div>
                </div>

                {/* Recent manual adjustments */}
                <div className="dash-card" style={{ marginBottom: 0 }}>
                  <div className="dash-card-title">Manual adjustments</div>
                  <div className="dash-stack" style={{ gap: '8px' }}>
                    {data.adjustments.length > 0 ? data.adjustments.slice(0, 4).map((adjustment) => (
                      <div key={adjustment.id} className="card text-11" style={{ padding: '10px' }}>
                        <div className="flex-start justify-between" style={{ gap: '8px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div className="font-600" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adjustment.customerName || adjustment.customerEmail}</div>
                            <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>{adjustment.type} · {adjustment.reason}</div>
                          </div>
                          <div className="text-right mono">
                            <div className="font-700">{fmt(adjustment.amountCents)}</div>
                            <div className="text-muted" style={{ fontSize: '9px', marginTop: '2px' }}>{timeAgo(adjustment.createdAt, now)}</div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="footnote">No adjustments documented.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Billing Snapshot */}
            <div className="dash-card">
              <div className="dash-card-title flex-between">
                <span>Customer billing profile snapshot</span>
                <span className="badge badge-accent">{data.customerBilling.length} clients</span>
              </div>
              <div className="overflow-hidden" style={{ overflowX: 'auto' }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Plan</th>
                      <th className="text-right">Total Paid</th>
                      <th className="text-center">Billing Risk</th>
                      <th>Last Payment Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customerBilling.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <div className="font-600">{customer.name || '—'}</div>
                          <div className="text-muted" style={{ fontSize: '10px' }}>{customer.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${customer.plan.priceCents === 0 ? 'badge-warning' : 'badge-accent'}`}>
                            {customer.plan.name}
                          </span>
                        </td>
                        <td className="text-right mono font-600">
                          {fmt(customer.totalPaidCents)}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${customer.hasFailedPayment ? 'badge-danger' : 'badge-success'}`}>
                            {customer.hasFailedPayment ? 'past due' : 'healthy'}
                          </span>
                        </td>
                        <td className="footnote">
                          {customer.lastPaymentAt ? timeAgo(customer.lastPaymentAt, now) : 'No payments yet'}
                        </td>
                        <td className="text-right">
                          <Link
                            href="/admin/customers?tab=accounts"
                            className="btn-border mono"
                            style={{ textDecoration: 'none', padding: '4px 10px', fontSize: '10px' }}
                          >
                            View Account
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Slide-out Invoice Detail Drawer */}
            {selectedInvoice && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
                <div
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
                  onClick={() => setSelectedInvoice(null)}
                />
                <div
                  className="dash-stack"
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '540px',
                    height: '100%',
                    background: 'var(--bg)',
                    borderLeft: '1px solid var(--border-bright)',
                    overflowY: 'auto',
                    padding: '24px',
                    zIndex: 60
                  }}
                >
                  <div className="flex-start justify-between" style={{ borderBottom: '1px solid var(--border-bright)', paddingBottom: '16px', marginBottom: '24px' }}>
                    <div>
                      <div className="badge badge-accent mb-8">Invoice Detail</div>
                      <h3 className="font-700 mono" style={{ fontSize: '20px' }}>{selectedInvoice.invoiceId}</h3>
                      <p className="text-12 text-muted" style={{ marginTop: '4px' }}>{selectedInvoice.customerName || selectedInvoice.customerEmail}</p>
                    </div>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="btn-border mono text-11"
                      style={{ padding: '6px 12px' }}
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="dash-stack" style={{ gap: '20px' }}>
                    <div className="dash-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
                      <div className="dash-stat">
                        <div className="dash-stat-label">Amount</div>
                        <div className="dash-stat-value">{fmt(selectedInvoice.amountCents)}</div>
                      </div>
                      <div className="dash-stat">
                        <div className="dash-stat-label">Status</div>
                        <div className="dash-stat-value" style={{ textTransform: 'capitalize' }}>{selectedInvoice.status}</div>
                      </div>
                    </div>

                    <div className="dash-card" style={{ marginBottom: 0 }}>
                      <div className="dash-card-title">Customer Snapshot</div>
                      <div className="dash-stack text-12" style={{ gap: '8px' }}>
                        <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                          <span className="text-muted">Email</span>
                          <span className="font-600">{selectedInvoice.customerEmail}</span>
                        </div>
                        <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                          <span className="text-muted">Plan ID</span>
                          <span className="font-600">{selectedInvoice.planName}</span>
                        </div>
                        <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                          <span className="text-muted">Stripe Charge ID</span>
                          <span className="font-600 mono" style={{ fontSize: '10px' }}>{selectedInvoice.stripePaymentId || '—'}</span>
                        </div>
                        <div className="flex-between">
                          <span className="text-muted">Verified Last Payment</span>
                          <span className="font-600">{selectedCustomer?.lastPaymentAt ? new Date(selectedCustomer.lastPaymentAt).toLocaleDateString() : '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="dash-card" style={{ marginBottom: 0 }}>
                      <div className="dash-card-title">Submit Manual Adjustments</div>
                      <div className="dash-stack" style={{ gap: '12px' }}>
                        <div>
                          <label className="block mono text-muted" style={{ fontSize: '10px', marginBottom: '4px' }}>ADJUSTMENT VALUE (USD)</label>
                          <input
                            className="input-field"
                            type="number"
                            min="1"
                            step="0.01"
                            value={adjustmentAmount}
                            onChange={(e) => setAdjustmentAmount(e.target.value)}
                            placeholder="Amount in USD"
                          />
                        </div>
                        <div>
                          <label className="block mono text-muted" style={{ fontSize: '10px', marginBottom: '4px' }}>EXPLANATION</label>
                          <input
                            className="input-field"
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                            placeholder="Reason for manual accounting ledger entry..."
                          />
                        </div>
                        <div className="flex gap-8" style={{ marginTop: '8px' }}>
                          <button
                            className="btn-border mono text-11"
                            style={{ padding: '8px 16px', background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' }}
                            onClick={() => void submitAdjustment('credit')}
                            disabled={actionLoading === 'credit'}
                          >
                            {actionLoading === 'credit' ? 'Saving...' : 'Apply Credit'}
                          </button>
                          <button
                            className="btn-border mono text-11"
                            style={{ padding: '8px 16px' }}
                            onClick={() => void submitAdjustment('refund')}
                            disabled={actionLoading === 'refund'}
                          >
                            {actionLoading === 'refund' ? 'Saving...' : 'Apply Refund'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {activeTab === 'plans' && <AdminPlansPage />}
    </div>
  );
}

export default function AdminBillingPage() {
  return (
    <Suspense fallback={
      <div className="flex-center" style={{ minHeight: 'calc(100vh - 80px)', justifyContent: 'center' }}>
        <div className="auth-spinner" />
      </div>
    }>
      <AdminBillingPageContent />
    </Suspense>
  );
}
