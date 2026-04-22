'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUser(d.user);
      setName(d.user?.name || '');
    });
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setProfileMsg(res.ok ? '✓ Saved!' : 'Failed to save.');
    setSavingProfile(false);
    setTimeout(() => setProfileMsg(''), 3000);
  }

  async function changePassword() {
    if (newPassword.length < 8) { setPasswordMsg('Password must be at least 8 characters.'); return; }
    setSavingPassword(true);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPasswordMsg(res.ok ? '✓ Password updated!' : data.error || 'Failed.');
    setSavingPassword(false);
    if (res.ok) { setCurrentPassword(''); setNewPassword(''); }
    setTimeout(() => setPasswordMsg(''), 3000);
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    await fetch('/api/account/delete', { method: 'DELETE' });
    router.push('/');
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">Manage your profile and security settings</p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Your name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Email</label>
            <input type="email" value={user?.email || ''} className="input-field opacity-60" disabled />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveProfile} className="btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
            {profileMsg && <span className="text-sm text-[var(--color-success)]">{profileMsg}</span>}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">Current Password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="input-field" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" minLength={8} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={changePassword} className="btn-primary" disabled={savingPassword || !currentPassword || !newPassword}>
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
            {passwordMsg && <span className="text-sm" style={{ color: passwordMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)' }}>{passwordMsg}</span>}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-6 border-[rgba(239,68,68,0.2)]" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
        <h2 className="text-lg font-semibold mb-1 text-[var(--color-danger)]">Danger Zone</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">Deleting your account will permanently remove all API keys, usage data, and cancel any active subscriptions.</p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            className="input-field max-w-48"
            placeholder={`Type DELETE`}
          />
          <button onClick={deleteAccount} className="btn-danger" disabled={deleteConfirm !== 'DELETE'}>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
