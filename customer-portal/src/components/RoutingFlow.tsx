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
    <div className="glass-card" style={{ padding: '24px', maxWidth: '576px', margin: '0 auto' }}>
      <div className="flex-center justify-between mb-16 mono text-9 uppercase text-muted" style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border)', letterSpacing: '0.08em' }}>
        <span>[routing_graph_state]</span>
        <span>GATEWAY: CONNECTED</span>
      </div>

      {/* Static routing diagram */}
      <div className="mb-16" style={{ position: 'relative', overflow: 'visible' }}>
        <svg
          viewBox="0 0 560 100"
          className="w-full"
          style={{ overflow: 'visible' }}
          aria-label="Static monospace routing flow diagram"
        >
          {/* Your App node */}
          <g>
            <rect x="4" y="34" width="88" height="32" rx="0" fill="#000000" stroke="var(--border-bright)" strokeWidth="1" />
            <text x="48" y="46" textAnchor="middle" fill="var(--muted)" fontSize="8" fontWeight="600" fontFamily="'Space Mono', monospace">CLIENT_APP</text>
            <text x="48" y="55" textAnchor="middle" fill="var(--text)" fontSize="9" fontWeight="700" fontFamily="'Space Mono', monospace">SDK Request</text>
          </g>

          {/* Line: App → Router */}
          <line x1="92" y1="50" x2="190" y2="50" stroke="var(--border-bright)" strokeWidth="1" />

          {/* Router node */}
          <g>
            <rect x="190" y="28" width="88" height="44" rx="0" fill="#000000" stroke="var(--text)" strokeWidth="1" />
            <circle cx="234" cy="44" r="10" fill="transparent" stroke="var(--border-bright)" strokeWidth="1" />
            <line x1="228" y1="44" x2="240" y2="44" stroke="var(--text)" strokeWidth="1" />
            <line x1="234" y1="38" x2="234" y2="50" stroke="var(--text)" strokeWidth="1" />
            <text x="234" y="65" textAnchor="middle" fill="var(--text)" fontSize="8" fontWeight="700" fontFamily="'Space Mono', monospace">GATEWAY</text>
          </g>

          {/* Lines: Router → Providers (4 branches) */}
          <path d="M278,50 L360,18" stroke="var(--border-bright)" strokeWidth="1" />
          <path d="M278,50 L360,36" stroke="var(--border-bright)" strokeWidth="1" />
          <path d="M278,50 L360,64" stroke="var(--border-bright)" strokeWidth="1" />
          <path d="M278,50 L360,82" stroke="var(--border-bright)" strokeWidth="1" />

          {/* Provider nodes */}
          {PROVIDERS.map((p, i) => {
            const y = [18, 36, 64, 82][i] - 12;
            const label = STATUS_LABELS[p.status];
            const statusColor = p.status === 'green' ? 'var(--accent)' : p.status === 'yellow' ? '#f59e0b' : '#ef4444';
            return (
              <g key={p.label}>
                <rect x="360" y={y} width="100" height="24" rx="0" fill="#000000" stroke="var(--border-bright)" strokeWidth="1" />
                <text x="366" y={y + 15} fill={statusColor} fontSize="8" fontWeight="700" fontFamily="'Space Mono', monospace">{label}</text>
                <text x="402" y={y + 11} fill="var(--text)" fontSize="8.5" fontWeight="600" fontFamily="'Space Mono', monospace">{p.label}</text>
                <text x="402" y={y + 19} fill="var(--muted)" fontSize="6" fontFamily="'Space Mono', monospace">{p.tps}</text>
                <text x="454" y={y + 15} textAnchor="end" fill="var(--text)" fontSize="7.5" fontWeight="600" fontFamily="'Space Mono', monospace">{p.latency}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Model health lists */}
      <div className="flex flex-col gap-6 mono text-10 text-muted">
        {PROVIDERS.map((m, i) => {
          const label = STATUS_LABELS[m.status];
          const statusColor = m.status === 'green' ? 'var(--accent)' : m.status === 'yellow' ? '#f59e0b' : '#ef4444';
          return (
            <div key={i} className="flex-center justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="font-600 text-bright">{m.name}</span>
              <div className="flex gap-16">
                <span>{m.tps}</span>
                <span>{m.latency}</span>
                <span className="font-700" style={{ color: statusColor }}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
