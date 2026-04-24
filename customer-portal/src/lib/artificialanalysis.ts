/**
 * Artificial Analysis API Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches live model performance data from artificialanalysis.ai.
 * All fetches are server-side only (API key never reaches the browser).
 * Uses Next.js ISR: data is regenerated in the background every hour,
 * so charts always reflect current AA rankings without manual updates.
 *
 * Falls back to MODEL_CATALOGUE static data if the AA API is unreachable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { MODEL_CATALOGUE } from './models';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModelMetric {
  id: string;
  name: string;
  provider: string;
  color: string;
  /** Artificial Analysis Intelligence Index score (0–100) */
  intelligenceScore: number;
  /** Output tokens per second (median P50) */
  outputSpeed: number;
  /** Time to first token in seconds */
  ttft: number;
  /** Blended input+output price per 1M tokens in USD */
  blendedPrice: number;
  /** Context window in tokens */
  contextWindow: number;
  /** Link to AA model profile */
  aaUrl: string;
  /** Whether this model is available through our platform */
  available: boolean;
}

export interface LeaderboardEntry extends ModelMetric {
  rank: number;
  delta: number; // rank change from previous period
}

// ── Config ────────────────────────────────────────────────────────────────────

const AA_API_BASE = 'https://api.artificialanalysis.ai/v1';
const AA_API_KEY = process.env.AA_API_KEY ?? 'aa_srqASlMVpwDcuNrBEHnbKZkejYwsPltX';

// ISR revalidation: 1 hour
const REVALIDATE_SECONDS = 3600;

// ── Static Fallback Data ───────────────────────────────────────────────────────
// Used when the AA API is unreachable. Reflects April 2026 data.

export const STATIC_MODEL_METRICS: ModelMetric[] = [
  {
    id: 'gpt-5-5',
    name: 'GPT-5.5',
    provider: 'OpenAI',
    color: '#10a37f',
    intelligenceScore: 60,
    outputSpeed: 89,
    ttft: 1.2,
    blendedPrice: 7.5,
    contextWindow: 128000,
    aaUrl: 'https://artificialanalysis.ai/models/gpt-5-5',
    available: true,
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'Anthropic',
    color: '#d4a96a',
    intelligenceScore: 57,
    outputSpeed: 41,
    ttft: 1.8,
    blendedPrice: 10.0,
    contextWindow: 200000,
    aaUrl: 'https://artificialanalysis.ai/models/claude-opus-4-7',
    available: true,
  },
  {
    id: 'gemini-3-1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'Google',
    color: '#4285f4',
    intelligenceScore: 57,
    outputSpeed: 95,
    ttft: 0.9,
    blendedPrice: 3.5,
    contextWindow: 2000000,
    aaUrl: 'https://artificialanalysis.ai/models/gemini-3-1-pro',
    available: true,
  },
  {
    id: 'gpt-5-4',
    name: 'GPT-5.4',
    provider: 'OpenAI',
    color: '#10a37f',
    intelligenceScore: 57,
    outputSpeed: 72,
    ttft: 1.4,
    blendedPrice: 5.6,
    contextWindow: 128000,
    aaUrl: 'https://artificialanalysis.ai/models/gpt-5-4',
    available: true,
  },
  {
    id: 'kimi-k2-6',
    name: 'Kimi K2.6',
    provider: 'Moonshot AI',
    color: '#a855f7',
    intelligenceScore: 54,
    outputSpeed: 88,
    ttft: 0.7,
    blendedPrice: 1.7,
    contextWindow: 131072,
    aaUrl: 'https://artificialanalysis.ai/models/kimi-k2-6',
    available: true,
  },
  {
    id: 'grok-4-20',
    name: 'Grok 4.20',
    provider: 'xAI',
    color: '#ff6b35',
    intelligenceScore: 49,
    outputSpeed: 165,
    ttft: 0.6,
    blendedPrice: 3.0,
    contextWindow: 1000000,
    aaUrl: 'https://artificialanalysis.ai/models/grok-4-20',
    available: true,
  },
  {
    id: 'deepseek-v3-2',
    name: 'DeepSeek V3.2',
    provider: 'DeepSeek',
    color: '#6366f1',
    intelligenceScore: 42,
    outputSpeed: 68,
    ttft: 1.4,
    blendedPrice: 0.3,
    contextWindow: 163840,
    aaUrl: 'https://artificialanalysis.ai/models/deepseek-v3-2',
    available: true,
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    color: '#d4a96a',
    intelligenceScore: 46,
    outputSpeed: 112,
    ttft: 0.9,
    blendedPrice: 3.0,
    contextWindow: 200000,
    aaUrl: 'https://artificialanalysis.ai/models/claude-sonnet-4-6',
    available: true,
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    color: '#4285f4',
    intelligenceScore: 40,
    outputSpeed: 180,
    ttft: 0.4,
    blendedPrice: 0.75,
    contextWindow: 1048576,
    aaUrl: 'https://artificialanalysis.ai/models/gemini-3-flash',
    available: true,
  },
  {
    id: 'gemini-3-1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'Google',
    color: '#4285f4',
    intelligenceScore: 36,
    outputSpeed: 210,
    ttft: 0.3,
    blendedPrice: 0.15,
    contextWindow: 1048576,
    aaUrl: 'https://artificialanalysis.ai/models/gemini-3-1-flash-lite',
    available: true,
  },
  {
    id: 'llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'Meta',
    color: '#0668e1',
    intelligenceScore: 38,
    outputSpeed: 120,
    ttft: 0.5,
    blendedPrice: 0.9,
    contextWindow: 1000000,
    aaUrl: 'https://artificialanalysis.ai/models/llama-4-maverick',
    available: true,
  },
];

// ── Raw AA API response types (best-effort; AA may change schema) ──────────────

interface AARawModel {
  model_id?: string;
  id?: string;
  name?: string;
  display_name?: string;
  provider?: string;
  organization?: string;
  intelligence_index?: number;
  quality_index?: number;
  output_tokens_per_second?: number;
  throughput?: number;
  time_to_first_token?: number;
  ttft?: number;
  blended_price?: number;
  price?: number;
  context_window?: number;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchAA(path: string): Promise<AARawModel[]> {
  const res = await fetch(`${AA_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${AA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`AA API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  // AA returns either an array or { data: [...] }
  return Array.isArray(json) ? json : (json.data ?? json.models ?? []);
}

/** Map provider name → brand color */
function providerColor(provider: string): string {
  const p = provider?.toLowerCase() ?? '';
  if (p.includes('openai')) return '#10a37f';
  if (p.includes('anthropic')) return '#d4a96a';
  if (p.includes('google') || p.includes('gemini')) return '#4285f4';
  if (p.includes('deepseek')) return '#6366f1';
  if (p.includes('meta') || p.includes('llama')) return '#0668e1';
  if (p.includes('xai') || p.includes('grok')) return '#ff6b35';
  if (p.includes('mistral')) return '#ff7000';
  if (p.includes('moonshot') || p.includes('kimi')) return '#a855f7';
  if (p.includes('qwen') || p.includes('alibaba')) return '#ff6900';
  return '#6366f1';
}

/** Convert a raw AA model object into our typed ModelMetric */
function normalizeModel(raw: AARawModel): ModelMetric {
  const id = raw.model_id ?? raw.id ?? '';
  const name = raw.display_name ?? raw.name ?? id;
  const provider = raw.organization ?? raw.provider ?? 'Unknown';
  const aaSlug = id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  // Find matching catalogue entry for color + availability
  const catalogueEntry = MODEL_CATALOGUE.find(
    (m) => m.id === id || m.id.replace(/-/g, '') === id.replace(/-/g, '')
  );

  return {
    id,
    name,
    provider,
    color: catalogueEntry?.color ?? providerColor(provider),
    intelligenceScore: Math.round(raw.intelligence_index ?? raw.quality_index ?? 0),
    outputSpeed: Math.round(raw.output_tokens_per_second ?? raw.throughput ?? 0),
    ttft: raw.time_to_first_token ?? raw.ttft ?? 0,
    blendedPrice: raw.blended_price ?? raw.price ?? 0,
    contextWindow: raw.context_window ?? 0,
    aaUrl: `https://artificialanalysis.ai/models/${aaSlug}`,
    available: true,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all model metrics from Artificial Analysis.
 * Falls back to STATIC_MODEL_METRICS if the API is unreachable.
 */
export async function getModelMetrics(): Promise<ModelMetric[]> {
  try {
    const raw = await fetchAA('/models');
    if (!raw || raw.length === 0) return STATIC_MODEL_METRICS;
    return raw.map(normalizeModel).filter((m) => m.intelligenceScore > 0 || m.outputSpeed > 0);
  } catch {
    console.warn('[AA] Falling back to static model metrics');
    return STATIC_MODEL_METRICS;
  }
}

/**
 * Fetch the intelligence leaderboard from Artificial Analysis, sorted by score.
 * Falls back to static data sorted by intelligenceScore.
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    // Try dedicated leaderboard endpoint first, fall back to /models sorted
    let raw: AARawModel[];
    try {
      raw = await fetchAA('/leaderboards/models');
    } catch {
      raw = await fetchAA('/models');
    }

    if (!raw || raw.length === 0) throw new Error('empty');

    const metrics = raw
      .map(normalizeModel)
      .filter((m) => m.intelligenceScore > 0)
      .sort((a, b) => b.intelligenceScore - a.intelligenceScore)
      .slice(0, 12);

    return metrics.map((m, i) => ({ ...m, rank: i + 1, delta: 0 }));
  } catch {
    console.warn('[AA] Falling back to static leaderboard');
    return STATIC_MODEL_METRICS
      .filter((m) => m.intelligenceScore > 0)
      .sort((a, b) => b.intelligenceScore - a.intelligenceScore)
      .map((m, i) => ({ ...m, rank: i + 1, delta: 0 }));
  }
}

/**
 * Return top N models by output speed.
 */
export async function getSpeedRanking(limit = 8): Promise<ModelMetric[]> {
  const metrics = await getModelMetrics();
  return metrics
    .filter((m) => m.outputSpeed > 0)
    .sort((a, b) => b.outputSpeed - a.outputSpeed)
    .slice(0, limit);
}

/**
 * Return models sorted by blended price (cheapest first).
 */
export async function getPriceRanking(limit = 8): Promise<ModelMetric[]> {
  const metrics = await getModelMetrics();
  return metrics
    .filter((m) => m.blendedPrice > 0)
    .sort((a, b) => a.blendedPrice - b.blendedPrice)
    .slice(0, limit);
}

/**
 * Return scatter data: intelligence vs price for the bubble chart.
 */
export async function getIntelligenceVsPrice(): Promise<ModelMetric[]> {
  const metrics = await getModelMetrics();
  return metrics.filter((m) => m.intelligenceScore > 0 && m.blendedPrice > 0);
}
