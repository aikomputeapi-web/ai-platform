'use client';

import { MODELS } from '@/lib/models';

interface Provider {
  name: string;
  label: string;
  color: string;
  status: 'green' | 'yellow' | 'red';
  latency: string;
  tps: string;
  pct: number;
}

const PROVIDERS: Provider[] = [
  { name: MODELS.OPENAI_FLAGSHIP,   label: 'OpenAI',    color: '#10a37f', status: 'green',  latency: '1.2s', tps: '89 t/s',  pct: 88 },
  { name: MODELS.ANTHROPIC_SONNET, label: 'Anthropic', color: '#d4a96a', status: 'green',  latency: '0.9s', tps: '112 t/s', pct: 95 },
  { name: MODELS.GOOGLE_FLASH,     label: 'Google',    color: '#4285f4', status: 'green',  latency: '0.4s', tps: '210 t/s', pct: 99 },
  { name: MODELS.DEEPSEEK_V3,      label: 'DeepSeek',  color: '#6366f1', status: 'yellow', latency: '1.4s', tps: '68 t/s',  pct: 78 },
];

const STATUS_COLORS = {
  green:  { dot: '#10b981', ring: '#10b98133', label: 'Operational' },
  yellow: { dot: '#f59e0b', ring: '#f59e0b33', label: 'Degraded' },
  red:    { dot: '#ef4444', ring: '#ef444433', label: 'Down' },
};

export default function RoutingFlow() {
  return (
    <div className="glass-card p-6 max-w-3xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
          Live Router Status
        </span>
        <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          All Systems Operational
        </span>
      </div>

      {/* Animated routing diagram */}
      <div className="relative mb-6">
        <svg
          viewBox="0 0 560 100"
          className="w-full"
          aria-label="Live routing flow diagram"
          style={{ overflow: 'visible' }}
        >
          {/* Your App node */}
          <g>
            <rect x="4" y="34" width="88" height="32" rx="8" fill="#1a1a2e" stroke="#2a2a40" strokeWidth="1.5" />
            <text x="48" y="47" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="600" fontFamily="Inter, system-ui">YOUR APP</text>
            <text x="48" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="700" fontFamily="Inter, system-ui">SDK Request</text>
          </g>

          {/* Arrow line: App → Router */}
          <line x1="92" y1="50" x2="190" y2="50" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
          {/* Animated packet dot */}
          <circle r="4" fill="#6366f1" opacity="0.9">
            <animateMotion dur="1.8s" repeatCount="indefinite" path="M92,50 L190,50" />
          </circle>

          {/* Router node */}
          <g>
            <rect x="190" y="28" width="88" height="44" rx="8" fill="#1a1a2e" stroke="#6366f1" strokeWidth="1.5" />
            {/* Router icon - circuit */}
            <circle cx="234" cy="44" r="12" fill="#6366f144" stroke="#6366f1" strokeWidth="1" />
            <line x1="228" y1="44" x2="240" y2="44" stroke="#6366f1" strokeWidth="1.5" />
            <line x1="234" y1="38" x2="234" y2="50" stroke="#6366f1" strokeWidth="1.5" />
            <circle cx="234" cy="44" r="3" fill="#6366f1" />
            <text x="234" y="66" textAnchor="middle" fill="#a78bfa" fontSize="8" fontWeight="700" fontFamily="Inter, system-ui">AI ROUTER</text>
          </g>

          {/* Lines: Router → Providers (4 branches) */}
          {/* Top-left */}
          <path d="M278,50 L360,18" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          <circle r="3.5" fill="#10b981" opacity="0.9">
            <animateMotion dur="1.2s" begin="0.2s" repeatCount="indefinite" path="M278,50 L360,18" />
          </circle>
          {/* Top-right */}
          <path d="M278,50 L360,36" stroke="#d4a96a" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          <circle r="3.5" fill="#d4a96a" opacity="0.9">
            <animateMotion dur="1.2s" begin="0.6s" repeatCount="indefinite" path="M278,50 L360,36" />
          </circle>
          {/* Bottom-left */}
          <path d="M278,50 L360,64" stroke="#4285f4" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          <circle r="3.5" fill="#4285f4" opacity="0.9">
            <animateMotion dur="1.2s" begin="1.0s" repeatCount="indefinite" path="M278,50 L360,64" />
          </circle>
          {/* Bottom-right */}
          <path d="M278,50 L360,82" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
          <circle r="3.5" fill="#6366f1" opacity="0.9">
            <animateMotion dur="1.2s" begin="1.4s" repeatCount="indefinite" path="M278,50 L360,82" />
          </circle>

          {/* Provider nodes */}
          {PROVIDERS.map((p, i) => {
            const y = [18, 36, 64, 82][i] - 12;
            const sc = STATUS_COLORS[p.status];
            return (
              <g key={p.label}>
                <rect x="360" y={y} width="100" height="24" rx="6" fill="#1a1a2e" stroke={p.color} strokeWidth="1.2" strokeOpacity="0.6" />
                {/* Status dot */}
                <circle cx="373" cy={y + 12} r="4" fill={sc.dot} opacity="0.9">
                  {p.status === 'green' && (
                    <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
                  )}
                </circle>
                <text x="381" y={y + 8} fill="#e2e8f0" fontSize="8" fontWeight="700" fontFamily="Inter, system-ui">{p.label}</text>
                <text x="381" y={y + 17} fill="#64748b" fontSize="7" fontFamily="Inter, system-ui">{p.tps}</text>
                {/* Latency right-aligned */}
                <text x="455" y={y + 13} textAnchor="end" fill={p.color} fontSize="7.5" fontWeight="600" fontFamily="Inter, system-ui">{p.latency}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Model health bars */}
      <div className="space-y-2.5">
        {PROVIDERS.map((m, i) => {
          const sc = STATUS_COLORS[m.status];
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.dot }} />
                <div
                  className="absolute inset-0 w-2 h-2 rounded-full animate-ping"
                  style={{ backgroundColor: sc.dot, opacity: 0.4 }}
                />
              </div>
              <span className="text-xs font-semibold text-white w-44 truncate">{m.name}</span>
              <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${m.pct}%`,
                    background: `linear-gradient(90deg, ${m.color}88, ${m.color})`,
                  }}
                />
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] w-14 text-right font-mono">{m.tps}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] w-10 text-right font-mono">{m.latency}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
