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
    <div>
      <div className="dash-page-header flex-between">
        <div>
          <h1 className="dash-page-title">API Keys</h1>
          <p className="dash-page-sub">Manage your API access credentials</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-accent lh-1">+ Create Key</button>
      </div>

      {/* New Key Created */}
      {newRawKey && (
        <div className="dash-card dash-card-accent">
          <div className="flex-start gap-12 mb-12">
            <span style={{ fontSize: '16px' }}>✅</span>
            <div>
              <div className="font-700 text-14">API Key Created</div>
              <div className="text-13 text-muted">Copy it now — you won&apos;t see it again.</div>
            </div>
          </div>
          <div className="flex-center gap-8 mt-12">
            <code className="dash-code flex-1 text-accent break-all">
              {newRawKey}
            </code>
            <button onClick={() => copyKey(newRawKey)} className="btn-border btn-sm">
              📋 Copy
            </button>
          </div>
          <button onClick={() => setNewRawKey('')} className="btn-ghost mt-12">
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && !newRawKey && (
        <div className="dash-card">
          <div className="dash-card-title">Create New API Key</div>
          {error && <div className="auth-error">{error}</div>}
          <div className="flex gap-12">
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              className="input-field flex-1"
              placeholder="Key name (e.g. Production, Testing)"
            />
            <button onClick={createKey} className="btn-accent lh-1" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => { setShowCreate(false); setError(''); }} className="btn-border lh-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Key List */}
      {keys.length === 0 ? (
        <div className="dash-card text-center" style={{ padding: '48px' }}>
          <div className="text-40 mb-16">🔑</div>
          <div className="font-700 mb-8 text-15">No API keys yet</div>
          <p className="text-13 text-muted mb-16">Create your first API key to start making requests.</p>
          <button onClick={() => setShowCreate(true)} className="btn-accent lh-1">Create Your First Key</button>
        </div>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map(key => (
              <tr key={key.id}>
                <td className="font-600">{key.name}</td>
                <td className="text-12 text-muted mono">
                  ork_•••• {key.lastFour || '????'}
                </td>
                <td>
                  <span className={`badge ${key.isActive ? 'badge-active' : 'badge-revoked'}`}>
                    {key.isActive ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td className="text-12 text-muted">
                  {new Date(key.createdAt).toLocaleDateString()}
                </td>
                <td>
                  {key.isActive && (
                    <button onClick={() => revokeKey(key.id)} className="btn-danger-sm">
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
