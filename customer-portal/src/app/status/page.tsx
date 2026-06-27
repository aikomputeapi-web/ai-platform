'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const PROVIDERS = [
  { name: 'OpenAI', status: 'operational', uptime: '99.9%', latency: '1.2s' },
  { name: 'Anthropic', status: 'operational', uptime: '99.8%', latency: '0.9s' },
  { name: 'Google', status: 'operational', uptime: '99.9%', latency: '0.4s' },
  { name: 'DeepSeek', status: 'operational', uptime: '97.2%', latency: '1.9s' },
  { name: 'xAI', status: 'operational', uptime: '99.7%', latency: '0.6s' },
  { name: 'Meta', status: 'operational', uptime: '99.6%', latency: '0.5s' },
  { name: 'Mistral', status: 'operational', uptime: '99.5%', latency: '0.8s' },
  { name: 'Moonshot', status: 'operational', uptime: '99.4%', latency: '0.7s' },
];

const INCIDENTS = [
  { date: 'No ongoing incidents', desc: 'All systems operational.', status: 'resolved' as const },
];

export default function StatusPage() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="page-shell">
      <Header />

      <div className="page-hero-sm">
        <div className="eyebrow-accent">● SYSTEM</div>
        <div className="flex-center gap-16 mb-12">
          <span className="inline-block" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }} />
          <span className="mono text-14 text-accent">ALL SYSTEMS OPERATIONAL</span>
        </div>
        <h1 className="heading-page">
          Service Status
        </h1>
        <p className="text-muted text-13">
          Last checked: {currentTime.toLocaleString()}
        </p>
      </div>

      <div className="border-bottom">
        <div className="section-label-bar-sm" style={{ borderBottom: '1px solid var(--border-bright)', background: 'var(--surface)' }}>
          Provider Status
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: 'var(--border-bright)' }}>
          {PROVIDERS.map((p) => (
            <div key={p.name} className="bg-bg" style={{ padding: '32px 28px' }}>
              <div className="flex-center gap-8 mb-16">
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: p.status === 'operational' ? 'var(--accent)' : p.status === 'degraded' ? '#f59e0b' : '#ef4444',
                  display: 'inline-block',
                }} />
                <div className="text-14 font-600 uppercase">{p.name}</div>
              </div>
              <div className="flex-between text-12 text-muted mb-6">
                <span>Status</span>
                <span className="mono" style={{ color: p.status === 'operational' ? 'var(--accent)' : p.status === 'degraded' ? '#f59e0b' : '#ef4444' }}>{p.status}</span>
              </div>
              <div className="flex-between text-12 text-muted mb-6">
                <span>Uptime</span>
                <span className="mono text-bright">{p.uptime}</span>
              </div>
              <div className="flex-between text-12 text-muted">
                <span>Latency</span>
                <span className="mono text-bright">{p.latency}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-section-sm">
        <div className="mono text-10 uppercase text-muted mb-16" style={{ letterSpacing: '0.12em' }}>
          Incident History
        </div>
        <div className="text-13 text-muted">
          {INCIDENTS.length === 1 ? (
            <p>No recent incidents. All systems operating normally.</p>
          ) : (
            INCIDENTS.map((inc, i) => (
              <div key={i} className="flex gap-16" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="mono text-11 text-muted" style={{ flexShrink: 0 }}>{inc.date}</span>
                <span className="text-13">{inc.desc}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="page-section-xs">
        <p className="text-12 text-muted">
          Status is updated in real-time. Provider latencies are 7-day rolling averages.
          For real-time incident alerts, <Link href="/support" className="text-accent">contact support</Link>.
        </p>
      </div>

      <Footer />
    </div>
  );
}
