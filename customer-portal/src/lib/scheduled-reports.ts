import { Prisma } from '@prisma/client';
import prisma from '@/lib/db';
import { sendHtmlEmail } from '@/lib/email';
import { getUsageAnalytics } from '@/lib/omniroute';

export interface ScheduledReportRecord {
  id: string;
  name: string;
  reportType: string;
  recipientEmail: string;
  cadence: string;
  enabled: boolean;
  filters: unknown;
  notes: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

interface ReportSummaryCard {
  label: string;
  value: string;
  sub?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

interface ReportSectionItem {
  label: string;
  value: string;
  sub?: string;
}

interface ReportSection {
  title: string;
  items: ReportSectionItem[];
}

interface ReportEmailContent {
  subject: string;
  preheader: string;
  intro: string;
  summary: ReportSummaryCard[];
  sections: ReportSection[];
  footer: string;
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'aikompute';

const DATE_RANGE_VALUES = new Set(['7d', '30d', '90d']);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(cents: number | bigint | null | undefined) {
  const value = Number(cents || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

function formatInteger(value: number | bigint | null | undefined) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function formatPercent(value: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function getFiltersObject(filters: unknown) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};
  return filters as Record<string, unknown>;
}

function getReportRange(filters: unknown): string {
  const normalized = getFiltersObject(filters);
  const candidate = typeof normalized.range === 'string' ? normalized.range : '30d';
  return DATE_RANGE_VALUES.has(candidate) ? candidate : '30d';
}

function cadenceLabel(cadence: string) {
  return cadence.charAt(0).toUpperCase() + cadence.slice(1);
}

function renderSummaryCards(summary: ReportSummaryCard[]) {
  return summary
    .map((card) => {
      const accent =
        card.tone === 'success'
          ? '#10b981'
          : card.tone === 'warning'
            ? '#f59e0b'
            : card.tone === 'danger'
              ? '#f43f5e'
              : '#6366f1';
      return `
        <td style="padding:8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#101522;border:1px solid rgba(255,255,255,0.07);border-radius:14px;">
            <tr>
              <td style="padding:16px 16px 12px;">
                <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;">${escapeHtml(card.label)}</div>
                <div style="font-size:28px;font-weight:800;color:#f8fafc;line-height:1.1;">${escapeHtml(card.value)}</div>
                ${card.sub ? `<div style="font-size:12px;color:#64748b;margin-top:6px;">${escapeHtml(card.sub)}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:${accent};"></td>
            </tr>
          </table>
        </td>
      `;
    })
    .join('');
}

function renderSection(section: ReportSection) {
  const rows = section.items.length
    ? section.items
        .map(
          (item) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="font-size:13px;color:#e2e8f0;font-weight:600;">${escapeHtml(item.label)}</div>
                ${item.sub ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${escapeHtml(item.sub)}</div>` : ''}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;font-size:13px;color:#94a3b8;font-weight:600;">${escapeHtml(item.value)}</td>
            </tr>
          `
        )
        .join('')
    : '<tr><td colspan="2" style="padding:12px 0;color:#64748b;font-size:13px;">No rows available.</td></tr>';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#101522;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:0 18px;">
      <tr>
        <td style="padding:16px 0 6px;">
          <div style="font-size:14px;font-weight:700;color:#f8fafc;">${escapeHtml(section.title)}</div>
        </td>
      </tr>
      ${rows}
    </table>
  `;
}

function renderReportEmail(content: ReportEmailContent) {
  const summaryRows: string[] = [];
  for (let index = 0; index < content.summary.length; index += 2) {
    summaryRows.push(`
      <tr>
        ${renderSummaryCards(content.summary.slice(index, index + 2))}
      </tr>
    `);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preheader)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#10b981);display:inline-flex;align-items:center;justify-content:center;">
                  <span style="color:white;font-size:18px;">◆</span>
                </div>
                <span style="font-size:18px;font-weight:700;color:#e2e8f0;">${escapeHtml(APP_NAME)}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(135deg,rgba(17,24,39,0.97),rgba(12,16,28,0.99));border:1px solid #1f2937;border-radius:18px;padding:38px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#f8fafc;line-height:1.25;">${escapeHtml(content.subject)}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#94a3b8;">${escapeHtml(content.intro)}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                ${summaryRows.join('')}
              </table>
              ${content.sections.map(renderSection).join('')}
              <p style="margin:24px 0 0;font-size:12px;color:#64748b;line-height:1.6;">${escapeHtml(content.footer)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;">© ${new Date().getFullYear()} ${escapeHtml(APP_NAME)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function getAccountReport(filters: unknown): Promise<ReportEmailContent> {
  const [totals, recentUsers, plans] = await Promise.all([
    prisma.$queryRaw<Array<{
      totalUsers: bigint;
      verifiedUsers: bigint;
      lockedUsers: bigint;
      activeApiKeys: bigint;
      newUsers7d: bigint;
      newUsers30d: bigint;
    }>>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "totalUsers",
        COUNT(*) FILTER (WHERE email_verified)::bigint AS "verifiedUsers",
        COUNT(*) FILTER (WHERE is_locked)::bigint AS "lockedUsers",
        (SELECT COUNT(*)::bigint FROM user_api_keys WHERE is_active)::bigint AS "activeApiKeys",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::bigint AS "newUsers7d",
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::bigint AS "newUsers30d"
      FROM users
    `),
    prisma.$queryRaw<Array<{
      email: string;
      name: string | null;
      planId: string;
      emailVerified: boolean;
      isLocked: boolean;
      createdAt: Date;
    }>>(Prisma.sql`
      SELECT email, name, plan_id AS "planId", email_verified AS "emailVerified", is_locked AS "isLocked", created_at AS "createdAt"
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `),
    prisma.$queryRaw<Array<{
      id: string;
      name: string;
      priceCents: bigint;
      userCount: bigint;
    }>>(Prisma.sql`
      SELECT
        p.id,
        p.name,
        p.price_cents AS "priceCents",
        COUNT(u.id)::bigint AS "userCount"
      FROM plans p
      LEFT JOIN users u ON u.plan_id = p.id
      GROUP BY p.id, p.name, p.price_cents, p.sort_order
      ORDER BY p.sort_order ASC
    `),
  ]);

  const counts = totals[0] || {
    totalUsers: BigInt(0),
    verifiedUsers: BigInt(0),
    lockedUsers: BigInt(0),
    activeApiKeys: BigInt(0),
    newUsers7d: BigInt(0),
    newUsers30d: BigInt(0),
  };

  const enabledPlans = plans
    .slice(0, 4)
    .map((plan) => `${plan.name}: ${formatInteger(plan.userCount)}`);

  return {
    subject: `${cadenceLabel(String(getFiltersObject(filters).cadence || 'daily'))} accounts report`,
    preheader: `Account overview with ${formatInteger(counts.totalUsers)} users and ${formatInteger(counts.activeApiKeys)} active keys.`,
    intro: `Here is the latest account health snapshot from ${APP_NAME}.`,
    summary: [
      { label: 'Total users', value: formatInteger(counts.totalUsers), sub: `+${formatInteger(counts.newUsers30d)} in 30 days`, tone: 'accent' },
      { label: 'Verified users', value: formatInteger(counts.verifiedUsers), sub: `${formatPercent(Number(counts.verifiedUsers), Number(counts.totalUsers))} verified`, tone: 'success' },
      { label: 'Locked users', value: formatInteger(counts.lockedUsers), sub: 'manual interventions', tone: 'warning' },
      { label: 'Active keys', value: formatInteger(counts.activeApiKeys), sub: 'customer credentials', tone: 'accent' },
    ],
    sections: [
      {
        title: 'Recent signups',
        items: recentUsers.map((user) => ({
          label: user.email,
          value: user.planId,
          sub: `${user.name || 'Unnamed'} · ${user.emailVerified ? 'verified' : 'unverified'} · ${user.isLocked ? 'locked' : 'active'} · ${formatDate(user.createdAt)}`,
        })),
      },
      {
        title: 'Plan distribution',
        items: plans.map((plan) => ({
          label: plan.name,
          value: formatInteger(plan.userCount),
          sub: `${formatCurrency(plan.priceCents)} / month`,
        })),
      },
      {
        title: 'Health notes',
        items: [
          { label: '7-day new users', value: formatInteger(counts.newUsers7d) },
          { label: '30-day new users', value: formatInteger(counts.newUsers30d) },
          { label: 'Top plan concentration', value: enabledPlans[0] || 'No plans yet' },
        ],
      },
    ],
    footer: `Account reports are generated from the current platform database at the time of delivery. Active plans: ${enabledPlans.join(' · ')}.`,
  };
}

async function getBillingReport(filters: unknown): Promise<ReportEmailContent> {
  const [payments, adjustments, recentPayments, recentAdjustments] = await Promise.all([
    prisma.$queryRaw<Array<{
      totalRevenueCents: bigint;
      monthRevenueCents: bigint;
      paymentCount: bigint;
      succeededCount: bigint;
      pendingCount: bigint;
    }>>(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('succeeded', 'completed') THEN amount_cents ELSE 0 END), 0)::bigint AS "totalRevenueCents",
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', NOW()) AND status IN ('succeeded', 'completed') THEN amount_cents ELSE 0 END), 0)::bigint AS "monthRevenueCents",
        COUNT(*)::bigint AS "paymentCount",
        COUNT(*) FILTER (WHERE status IN ('succeeded', 'completed'))::bigint AS "succeededCount",
        COUNT(*) FILTER (WHERE status = 'pending')::bigint AS "pendingCount"
      FROM payments
    `),
    prisma.$queryRaw<Array<{
      creditCents: bigint;
      refundCents: bigint;
      creditCount: bigint;
      refundCount: bigint;
    }>>(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount_cents ELSE 0 END), 0)::bigint AS "creditCents",
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount_cents ELSE 0 END), 0)::bigint AS "refundCents",
        COUNT(*) FILTER (WHERE type = 'credit')::bigint AS "creditCount",
        COUNT(*) FILTER (WHERE type = 'refund')::bigint AS "refundCount"
      FROM billing_adjustments
    `),
    prisma.$queryRaw<Array<{
      amountCents: bigint;
      status: string;
      createdAt: Date;
      email: string | null;
      planId: string | null;
    }>>(Prisma.sql`
      SELECT p.amount_cents AS "amountCents", p.status, p.created_at AS "createdAt", u.email, p.plan_id AS "planId"
      FROM payments p
      LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT 5
    `),
    prisma.$queryRaw<Array<{
      type: string;
      amountCents: bigint;
      reason: string;
      createdAt: Date;
      email: string | null;
    }>>(Prisma.sql`
      SELECT a.type, a.amount_cents AS "amountCents", a.reason, a.created_at AS "createdAt", u.email
      FROM billing_adjustments a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 5
    `),
  ]);

  const summary = payments[0] || {
    totalRevenueCents: BigInt(0),
    monthRevenueCents: BigInt(0),
    paymentCount: BigInt(0),
    succeededCount: BigInt(0),
    pendingCount: BigInt(0),
  };
  const adjustmentSummary = adjustments[0] || {
    creditCents: BigInt(0),
    refundCents: BigInt(0),
    creditCount: BigInt(0),
    refundCount: BigInt(0),
  };

  return {
    subject: `${cadenceLabel(String(getFiltersObject(filters).cadence || 'daily'))} billing report`,
    preheader: `Revenue, payments, credits, and refunds for the current billing window.`,
    intro: `This billing snapshot highlights revenue flow, recent payments, and manual adjustments across ${APP_NAME}.`,
    summary: [
      { label: 'Revenue', value: formatCurrency(summary.totalRevenueCents), sub: `${formatCurrency(summary.monthRevenueCents)} this month`, tone: 'success' },
      { label: 'Payments', value: formatInteger(summary.paymentCount), sub: `${formatInteger(summary.succeededCount)} succeeded`, tone: 'accent' },
      { label: 'Credits', value: formatCurrency(adjustmentSummary.creditCents), sub: `${formatInteger(adjustmentSummary.creditCount)} credits`, tone: 'warning' },
      { label: 'Refunds', value: formatCurrency(adjustmentSummary.refundCents), sub: `${formatInteger(adjustmentSummary.refundCount)} refunds`, tone: 'danger' },
    ],
    sections: [
      {
        title: 'Recent payments',
        items: recentPayments.map((payment) => ({
          label: payment.email || 'Unknown customer',
          value: formatCurrency(payment.amountCents),
          sub: `${payment.status} · ${payment.planId || 'no plan'} · ${formatDate(payment.createdAt)}`,
        })),
      },
      {
        title: 'Recent adjustments',
        items: recentAdjustments.map((adjustment) => ({
          label: `${adjustment.type} · ${adjustment.email || 'Unknown customer'}`,
          value: formatCurrency(adjustment.amountCents),
          sub: `${adjustment.reason} · ${formatDate(adjustment.createdAt)}`,
        })),
      },
      {
        title: 'Billing health',
        items: [
          { label: 'Payment attempts', value: formatInteger(summary.paymentCount) },
          { label: 'Pending payments', value: formatInteger(summary.pendingCount) },
          { label: 'Adjustment balance', value: formatCurrency(Number(adjustmentSummary.creditCents) - Number(adjustmentSummary.refundCents)) },
        ],
      },
    ],
    footer: `Billing reports are built from payments and billing adjustments stored in the platform database.`,
  };
}

async function getUsageReport(filters: unknown): Promise<ReportEmailContent> {
  const range = getReportRange(filters);
  const analytics = await getUsageAnalytics(range);
  const dailyTrend = Array.isArray(analytics?.dailyTrend) ? analytics.dailyTrend.slice(-7) : [];
  const byModel = Array.isArray(analytics?.byModel) ? analytics.byModel.slice(0, 5) : [];
  const summary = analytics?.summary || {};

  return {
    subject: `${cadenceLabel(String(getFiltersObject(filters).cadence || 'daily'))} usage report`,
    preheader: `Request, token, and model usage for the last ${range}.`,
    intro: `This usage snapshot pulls request and token activity from OmniRoute for ${APP_NAME}.`,
    summary: [
      { label: 'Requests', value: formatInteger(summary.totalRequests), sub: `window ${range}`, tone: 'accent' },
      { label: 'Tokens', value: formatInteger(summary.totalTokens), sub: 'combined usage', tone: 'success' },
      { label: 'Cost', value: formatCurrency(summary.totalCost), sub: 'estimated platform spend', tone: 'warning' },
      { label: 'Models tracked', value: formatInteger(byModel.length), sub: 'top models in use', tone: 'accent' },
    ],
    sections: [
      {
        title: 'Top models',
        items: byModel.map((model: { model?: string; requests?: number }) => ({
          label: model.model || 'Unknown model',
          value: formatInteger(model.requests),
          sub: 'requests in the selected window',
        })),
      },
      {
        title: 'Recent trend',
        items: dailyTrend.map((point: { date?: string; requests?: number; totalTokens?: number }) => ({
          label: point.date || 'Unknown day',
          value: formatInteger(point.requests),
          sub: `${formatInteger(point.totalTokens)} tokens`,
        })),
      },
      {
        title: 'Usage notes',
        items: [
          { label: 'Range', value: range },
          { label: 'Peak activity', value: dailyTrend.length ? String(dailyTrend[dailyTrend.length - 1]?.date || 'recent') : 'No data' },
        ],
      },
    ],
    footer: `Usage reports use the OmniRoute analytics endpoint and may be summarized when upstream data is unavailable.`,
  };
}

async function getSupportReport(filters: unknown): Promise<ReportEmailContent> {
  const [summaryRows, recentTickets] = await Promise.all([
    prisma.$queryRaw<Array<{
      openCount: bigint;
      triagedCount: bigint;
      waitingCount: bigint;
      closedCount: bigint;
      criticalCount: bigint;
      highCount: bigint;
    }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::bigint AS "openCount",
        COUNT(*) FILTER (WHERE status = 'triaged')::bigint AS "triagedCount",
        COUNT(*) FILTER (WHERE status = 'waiting')::bigint AS "waitingCount",
        COUNT(*) FILTER (WHERE status = 'closed')::bigint AS "closedCount",
        COUNT(*) FILTER (WHERE priority = 'critical')::bigint AS "criticalCount",
        COUNT(*) FILTER (WHERE priority = 'high')::bigint AS "highCount"
      FROM support_tickets
    `),
    prisma.$queryRaw<Array<{
      subject: string;
      status: string;
      priority: string;
      assignedTo: string | null;
      email: string | null;
      createdAt: Date;
    }>>(Prisma.sql`
      SELECT t.subject, t.status, t.priority, t.assigned_to AS "assignedTo", u.email, t.created_at AS "createdAt"
      FROM support_tickets t
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
      LIMIT 5
    `),
  ]);

  const summary = summaryRows[0] || {
    openCount: BigInt(0),
    triagedCount: BigInt(0),
    waitingCount: BigInt(0),
    closedCount: BigInt(0),
    criticalCount: BigInt(0),
    highCount: BigInt(0),
  };

  return {
    subject: `${cadenceLabel(String(getFiltersObject(filters).cadence || 'daily'))} support report`,
    preheader: `Ticket activity, priority mix, and queue health.`,
    intro: `This support snapshot helps the owner track open work, escalations, and queue movement.`,
    summary: [
      { label: 'Open', value: formatInteger(summary.openCount), sub: 'needs attention', tone: 'warning' },
      { label: 'Triaged', value: formatInteger(summary.triagedCount), sub: 'in review', tone: 'accent' },
      { label: 'Waiting', value: formatInteger(summary.waitingCount), sub: 'pending customer response', tone: 'accent' },
      { label: 'Closed', value: formatInteger(summary.closedCount), sub: 'resolved tickets', tone: 'success' },
    ],
    sections: [
      {
        title: 'Recent tickets',
        items: recentTickets.map((ticket) => ({
          label: `${ticket.subject}`,
          value: ticket.status,
          sub: `${ticket.email || 'Unknown customer'} · ${ticket.priority} priority · ${ticket.assignedTo || 'unassigned'} · ${formatDate(ticket.createdAt)}`,
        })),
      },
      {
        title: 'Priority mix',
        items: [
          { label: 'Critical', value: formatInteger(summary.criticalCount) },
          { label: 'High', value: formatInteger(summary.highCount) },
          { label: 'Open queue', value: formatInteger(summary.openCount) },
        ],
      },
    ],
    footer: `Support reports reflect ticket records stored in the platform database.`,
  };
}

export async function buildScheduledReportEmail(report: ScheduledReportRecord): Promise<ReportEmailContent> {
  const reportType = String(report.reportType || 'usage').toLowerCase();

  switch (reportType) {
    case 'billing':
      return getBillingReport(report.filters);
    case 'accounts':
      return getAccountReport(report.filters);
    case 'support':
      return getSupportReport(report.filters);
    case 'usage':
    default:
      return getUsageReport(report.filters);
  }
}

export async function sendScheduledReportEmail(report: ScheduledReportRecord): Promise<boolean> {
  const content = await buildScheduledReportEmail(report);
  const html = renderReportEmail(content);
  return sendHtmlEmail({
    to: report.recipientEmail,
    subject: `${APP_NAME} ${report.name} - ${content.subject}`,
    html,
  });
}

export function getNextRunAt(cadence: string) {
  const next = new Date();
  switch (cadence) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'daily':
    default:
      next.setDate(next.getDate() + 1);
      break;
  }
  return next;
}
