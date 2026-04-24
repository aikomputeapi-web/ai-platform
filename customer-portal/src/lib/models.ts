/**
 * Central Model Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the SINGLE SOURCE OF TRUTH for all model names displayed on the
 * website. Update a name here and it will automatically update everywhere it
 * is referenced.
 *
 * To edit these names, visit:  /admin/models  (admin panel)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const MODELS = {
  // ── Frontier / Premium ───────────────────────────────────────────────────
  OPENAI_FLAGSHIP:       'GPT-5.5',
  OPENAI_FLAGSHIP_ID:    'gpt-5-5',
  OPENAI_REASONING:      'GPT-5.4',
  OPENAI_REASONING_ID:   'gpt-5-4',
  OPENAI_MINI:           'GPT-5.4 Mini',
  OPENAI_MINI_ID:        'gpt-5-4-mini',
  OPENAI_NANO:           'GPT-5.4 Nano',
  OPENAI_NANO_ID:        'gpt-5-4-nano',

  ANTHROPIC_OPUS:        'Claude Opus 4.7',
  ANTHROPIC_OPUS_ID:     'claude-opus-4-7',
  ANTHROPIC_SONNET:      'Claude Sonnet 4.6',
  ANTHROPIC_SONNET_ID:   'claude-sonnet-4-6',
  ANTHROPIC_HAIKU:       'Claude Haiku 4.5',
  ANTHROPIC_HAIKU_ID:    'claude-4-5-haiku',

  GOOGLE_PRO:            'Gemini 3.1 Pro',
  GOOGLE_PRO_ID:         'gemini-3-1-pro',
  GOOGLE_FLASH:          'Gemini 3 Flash',
  GOOGLE_FLASH_ID:       'gemini-3-flash',
  GOOGLE_FLASH_LITE:     'Gemini 3.1 Flash-Lite',
  GOOGLE_FLASH_LITE_ID:  'gemini-3-1-flash-lite',

  DEEPSEEK_V3:           'DeepSeek V3.2',
  DEEPSEEK_V3_ID:        'deepseek-v3-2',
  DEEPSEEK_R1:           'DeepSeek R1',
  DEEPSEEK_R1_ID:        'deepseek-r1',

  GROK_FLAGSHIP:         'Grok 4.20',
  GROK_FLAGSHIP_ID:      'grok-4-20',
  GROK_FAST:             'Grok 4.1 Fast',
  GROK_FAST_ID:          'grok-4-1-fast',

  META_MAVERICK:         'Llama 4 Maverick',
  META_MAVERICK_ID:      'llama-4-maverick',
  META_SCOUT:            'Llama 4 Scout',
  META_SCOUT_ID:         'llama-4-scout',

  MISTRAL_LARGE:         'Mistral Large 3',
  MISTRAL_LARGE_ID:      'mistral-large-3',
  MISTRAL_SMALL:         'Mistral Small 4',
  MISTRAL_SMALL_ID:      'mistral-small-4',

  QWEN_FLAGSHIP:         'Qwen3.6 Max',
  QWEN_FLAGSHIP_ID:      'qwen3-6-max',

  KIMI_FLAGSHIP:         'Kimi K2.6',
  KIMI_FLAGSHIP_ID:      'kimi-k2-6',
} as const;

/** Typed model names for autocomplete support */
export type ModelKey = keyof typeof MODELS;

/**
 * Curated model catalogue used in the UI (marketing, docs, model browser).
 * Each entry maps to an artificialanalysis.ai profile for live stats.
 */
export const MODEL_CATALOGUE = [
  {
    key:       'OPENAI_FLAGSHIP',
    name:      MODELS.OPENAI_FLAGSHIP,
    id:        MODELS.OPENAI_FLAGSHIP_ID,
    provider:  'OpenAI',
    color:     '#10a37f',
    badge:     '#1 Intelligence',
    tier:      'frontier',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.OPENAI_FLAGSHIP_ID}`,
    blurb:     'The most intelligent model available. Top of the Artificial Analysis Intelligence Index.',
  },
  {
    key:       'ANTHROPIC_OPUS',
    name:      MODELS.ANTHROPIC_OPUS,
    id:        MODELS.ANTHROPIC_OPUS_ID,
    provider:  'Anthropic',
    color:     '#d4a96a',
    badge:     'Best Coding',
    tier:      'frontier',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.ANTHROPIC_OPUS_ID}`,
    blurb:     "Anthropic's most capable model. Exceptional at complex reasoning and safe outputs.",
  },
  {
    key:       'ANTHROPIC_SONNET',
    name:      MODELS.ANTHROPIC_SONNET,
    id:        MODELS.ANTHROPIC_SONNET_ID,
    provider:  'Anthropic',
    color:     '#d4a96a',
    badge:     'Best Value',
    tier:      'standard',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.ANTHROPIC_SONNET_ID}`,
    blurb:     'The sweet spot: near-opus intelligence at a fraction of the cost.',
  },
  {
    key:       'GOOGLE_PRO',
    name:      MODELS.GOOGLE_PRO,
    id:        MODELS.GOOGLE_PRO_ID,
    provider:  'Google',
    color:     '#4285f4',
    badge:     'Top Intelligence',
    tier:      'frontier',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.GOOGLE_PRO_ID}`,
    blurb:     'Google's frontier model with 2M token context and multimodal capabilities.',
  },
  {
    key:       'GOOGLE_FLASH',
    name:      MODELS.GOOGLE_FLASH,
    id:        MODELS.GOOGLE_FLASH_ID,
    provider:  'Google',
    color:     '#4285f4',
    badge:     'Fastest',
    tier:      'fast',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.GOOGLE_FLASH_ID}`,
    blurb:     'Blazing-fast inference at low cost, ideal for high-volume production use.',
  },
  {
    key:       'OPENAI_REASONING',
    name:      MODELS.OPENAI_REASONING,
    id:        MODELS.OPENAI_REASONING_ID,
    provider:  'OpenAI',
    color:     '#10a37f',
    badge:     'Deep Reasoning',
    tier:      'frontier',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.OPENAI_REASONING_ID}`,
    blurb:     'Extended thinking for the hardest math, science, and coding problems.',
  },
  {
    key:       'DEEPSEEK_V3',
    name:      MODELS.DEEPSEEK_V3,
    id:        MODELS.DEEPSEEK_V3_ID,
    provider:  'DeepSeek',
    color:     '#6366f1',
    badge:     'Open Weights',
    tier:      'open',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.DEEPSEEK_V3_ID}`,
    blurb:     'Leading open-weights model. High intelligence at an ultra-low price.',
  },
  {
    key:       'GROK_FLAGSHIP',
    name:      MODELS.GROK_FLAGSHIP,
    id:        MODELS.GROK_FLAGSHIP_ID,
    provider:  'xAI',
    color:     '#ff6b35',
    badge:     '1M Context',
    tier:      'frontier',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.GROK_FLAGSHIP_ID}`,
    blurb:     'xAI's flagship with massive context window and strong reasoning.',
  },
  {
    key:       'META_MAVERICK',
    name:      MODELS.META_MAVERICK,
    id:        MODELS.META_MAVERICK_ID,
    provider:  'Meta',
    color:     '#0668e1',
    badge:     'Open Source',
    tier:      'open',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.META_MAVERICK_ID}`,
    blurb:     'Meta's best open-source model. Self-host or use via API.',
  },
  {
    key:       'KIMI_FLAGSHIP',
    name:      MODELS.KIMI_FLAGSHIP,
    id:        MODELS.KIMI_FLAGSHIP_ID,
    provider:  'Moonshot AI',
    color:     '#a855f7',
    badge:     '#1 Open Weights',
    tier:      'open',
    aaUrl:     `https://artificialanalysis.ai/models/${MODELS.KIMI_FLAGSHIP_ID}`,
    blurb:     'Highest-ranked open-weights model on the Artificial Analysis leaderboard.',
  },
] as const;
