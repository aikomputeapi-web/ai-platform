'use client';

import { useEffect, useState } from 'react';

interface ApiKey {
  id: string;
  name: string;
  lastFour: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newRawKey, setNewRawKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadKeys() {
    const res = await fetch('/api/keys');
    const data = await res.json();
    setKeys(data.keys || []);
  }

  useEffect(() => { loadKeys(); }, []);

  async function createKey() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'My API Key' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setNewRawKey(data.rawKey);
      setNewKeyName('');
      await loadKeys();
    } catch {
      setError('Failed to create key');
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm('Are you sure? This API key will stop working immediately.')) return;
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId }),
    });
    await loadKeys();
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Manage your API access credentials</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Create Key
        </button>
      </div>

      {/* New Key Modal */}
      {newRawKey && (
        <div className="glass-card p-6 mb-6 border-[var(--color-success)]" style={{ borderColor: 'var(--color-success)' }}>
          <div className="flex items-start gap-3 mb-3">
            <span className="text-lg">✅</span>
            <div>
              <h3 className="font-semibold">API Key Created</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Copy it now — you won&apos;t see it again.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <code className="flex-1 bg-[var(--color-bg-primary)] rounded-lg px-4 py-3 text-sm font-mono text-[var(--color-success)] break-all">
              {newRawKey}
            </code>
            <button onClick={() => copyKey(newRawKey)} className="btn-secondary text-xs whitespace-nowrap">
              📋 Copy
            </button>
          </div>
          <button onClick={() => setNewRawKey('')} className="text-xs text-[var(--color-text-muted)] mt-3 hover:text-[var(--color-text-secondary)]">
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && !newRawKey && (
        <div className="glass-card p-6 mb-6">
          <h3 className="font-semibold mb-4">Create New API Key</h3>
          {error && <div className="text-sm text-[var(--color-danger)] mb-3">{error}</div>}
          <div className="flex gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              className="input-field flex-1"
              placeholder="Key name (e.g. Production, Testing)"
            />
            <button onClick={createKey} className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => { setShowCreate(false); setError(''); }} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Key List */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-4xl mb-4">🔑</div>
            <h3 className="font-semibold mb-2">No API keys yet</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">Create your first API key to start making requests.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create Your First Key</button>
          </div>
        ) : (
          keys.map(key => (
            <div key={key.id} className="glass-card p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: key.isActive ? 'var(--color-accent-subtle)' : 'rgba(239,68,68,0.1)' }}>
                  🔑
                </div>
                <div>
                  <div className="font-medium text-sm">{key.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                    ork_•••• {key.lastFour || '????'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={key.isActive ? 'badge-success' : 'badge-danger'}>
                  {key.isActive ? 'Active' : 'Revoked'}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {new Date(key.createdAt).toLocaleDateString()}
                </span>
                {key.isActive && (
                  <button onClick={() => revokeKey(key.id)} className="btn-danger text-xs">
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
