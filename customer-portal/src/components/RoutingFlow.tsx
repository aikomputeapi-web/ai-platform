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
  { name: MODELS.OPENAI_FLAGSHIP,   label: 'OpenAI',    color: '#ffffff', status: 'green',  latency: '1.2s', tps: '89 t/s',  pct: 88 },
  { name: MODELS.ANTHROPIC_SONNET, label: 'Anthropic', color: '#ffffff', status: 'green',  latency: '0.9s', tps: '112 t/s', pct: 95 },
  { name: MODELS.GOOGLE_FLASH,     label: 'Google',    color: '#ffffff', status: 'green',  latency: '0.4s', tps: '210 t/s', pct: 99 },
  { name: MODELS.DEEPSEEK_V3,      label: 'DeepSeek',  color: '#ffffff', status: 'yellow', latency: '1.4s', tps: '68 t/s',  pct: 78 },
];

const STATUS_LABELS = {
  green:  '[OK]',
  yellow: '[DEGR]',
  red:    '[DOWN]',
};

export default function RoutingFlow() {
  return (
    <div className="glass-card p-4 max-w-xl mx-auto border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--color-border)] text-[9px] font-mono tracking-wider uppercase text-[var(--color-text-secondary)]">
        <span>[routing_graph_state]</span>
        <span>GATEWAY: CONNECTED</span>
      </div>

      {/* Static routing diagram */}
      <div className="relative mb-4 overflow-visible">
        <svg
          viewBox="0 0 560 100"
          className="w-full"
          aria-label="Static monospace routing flow diagram"
          style={{ overflow: 'visible' }}
        >
          {/* Your App node */}
          <g>
            <rect x="4" y="34" width="88" height="32" rx="0" fill="#000000" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <text x="48" y="46" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="8" fontWeight="600" fontFamily="var(--font-mono)">CLIENT_APP</text>
            <text x="48" y="55" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700" fontFamily="var(--font-mono)">SDK Request</text>
          </g>

          {/* Line: App → Router */}
          <line x1="92" y1="50" x2="190" y2="50" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />

          {/* Router node */}
          <g>
            <rect x="190" y="28" width="88" height="44" rx="0" fill="#000000" stroke="#ffffff" strokeWidth="1" />
            <circle cx="234" cy="44" r="10" fill="transparent" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
            <line x1="228" y1="44" x2="240" y2="44" stroke="#ffffff" strokeWidth="1" />
            <line x1="234" y1="38" x2="234" y2="50" stroke="#ffffff" strokeWidth="1" />
            <text x="234" y="65" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="700" fontFamily="var(--font-mono)">GATEWAY</text>
          </g>

          {/* Lines: Router → Providers (4 branches) */}
          <path d="M278,50 L360,18" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <path d="M278,50 L360,36" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <path d="M278,50 L360,64" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
          <path d="M278,50 L360,82" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />

          {/* Provider nodes */}
          {PROVIDERS.map((p, i) => {
            const y = [18, 36, 64, 82][i] - 12;
            const label = STATUS_LABELS[p.status];
            return (
              <g key={p.label}>
                <rect x="360" y={y} width="100" height="24" rx="0" fill="#000000" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <text x="366" y={y + 15} fill="#ffffff" fontSize="8" fontWeight="700" fontFamily="var(--font-mono)">{label}</text>
                <text x="402" y={y + 11} fill="#ffffff" fontSize="8.5" fontWeight="600" fontFamily="var(--font-mono)">{p.label}</text>
                <text x="402" y={y + 19} fill="var(--color-text-muted)" fontSize="6" fontFamily="var(--font-mono)">{p.tps}</text>
                <text x="454" y={y + 15} textAnchor="end" fill="#ffffff" fontSize="7.5" fontWeight="600" fontFamily="var(--font-mono)">{p.latency}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Model health lists */}
      <div className="space-y-1.5 font-mono text-[9px] text-[var(--color-text-secondary)]">
        {PROVIDERS.map((m, i) => {
          const label = STATUS_LABELS[m.status];
          return (
            <div key={i} className="flex items-center justify-between py-0.5 border-b border-white/[0.02] last:border-0">
              <span className="font-semibold text-white">{m.name}</span>
              <div className="flex gap-4">
                <span>{m.tps}</span>
                <span>{m.latency}</span>
                <span className="text-white font-bold">{label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
