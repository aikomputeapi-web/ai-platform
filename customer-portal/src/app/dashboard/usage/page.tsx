'use client';
import { useEffect, useState } from 'react';

export default function UsagePage() {
  const [usage, setUsage] = useState<any>(null);
  const [range, setRange] = useState('30d');
  useEffect(() => { fetch(`/api/usage?range=${range}`).then(r => r.json()).then(setUsage); }, [range]);
  const ranges = ['1d','7d','30d','90d'];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">Usage</h1><p className="text-[var(--color-text-secondary)] text-sm mt-1">Track your API consumption</p></div>
        <div className="flex gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-1 border border-[var(--color-border)]">
          {ranges.map(r => (<button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${range === r ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}>{r}</button>))}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[{l:'Requests',v:usage?.summary?.totalRequests||0},{l:'Prompt Tokens',v:usage?.summary?.promptTokens?`${(usage.summary.promptTokens/1000).toFixed(1)}K`:'0'},{l:'Completion Tokens',v:usage?.summary?.completionTokens?`${(usage.summary.completionTokens/1000).toFixed(1)}K`:'0'},{l:'Est. Cost',v:`$${usage?.summary?.totalCost?.toFixed(4)||'0.00'}`}].map((s,i)=>(<div key={i} className="stat-card"><div className="text-xs text-[var(--color-text-muted)] mb-1">{s.l}</div><div className="stat-value">{s.v}</div></div>))}
      </div>
      {usage?.byModel?.length > 0 && (<div className="glass-card p-6"><h2 className="text-lg font-semibold mb-4">Models Used</h2><div className="space-y-3">{usage.byModel.slice(0,10).map((m:any,i:number)=>(<div key={i} className="flex items-center justify-between"><span className="text-sm font-medium">{m.model}</span><div className="text-right"><div className="text-sm">{m.requests} req</div><div className="text-xs text-[var(--color-text-muted)]">{(m.totalTokens/1000).toFixed(1)}K tok</div></div></div>))}</div></div>)}
      {(!usage?.summary?.totalRequests) && (<div className="glass-card p-12 text-center"><div className="text-4xl mb-4">📈</div><h3 className="font-semibold mb-2">No usage data yet</h3><p className="text-sm text-[var(--color-text-secondary)]">Start making API requests to see analytics.</p></div>)}
    </div>
  );
}
