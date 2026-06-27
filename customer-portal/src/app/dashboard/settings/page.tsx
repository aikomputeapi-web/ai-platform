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
    <div className="dash-content-narrow">
      <div className="dash-page-header">
        <h1 className="dash-page-title">Settings</h1>
        <p className="dash-page-sub">Manage your profile and security settings</p>
      </div>

      {/* Profile */}
      <div className="dash-card">
        <div className="dash-card-title">Profile</div>
        <div className="auth-form">
          <div>
            <label className="auth-label">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Your name" />
          </div>
          <div>
            <label className="auth-label">Email</label>
            <input type="email" value={user?.email || ''} className="input-field" disabled />
          </div>
          <div className="flex-center gap-12">
            <button onClick={saveProfile} className="auth-submit btn-auto" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
            {profileMsg && <span className="text-12 text-accent">{profileMsg}</span>}
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="dash-card">
        <div className="dash-card-title">Change Password</div>
        <div className="auth-form">
          <div>
            <label className="auth-label">Current Password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="input-field" placeholder="••••••••" />
          </div>
          <div>
            <label className="auth-label">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" minLength={8} />
          </div>
          <div className="flex-center gap-12">
            <button onClick={changePassword} className="auth-submit btn-auto" disabled={savingPassword || !currentPassword || !newPassword}>
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
            {passwordMsg && <span className={`text-12 ${passwordMsg.startsWith('✓') ? 'text-accent' : 'text-danger'}`}>{passwordMsg}</span>}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="dash-card dash-card-danger">
        <div className="dash-card-title text-danger">Danger Zone</div>
        <p className="text-13 text-muted mb-16" style={{ lineHeight: 1.7 }}>
          Deleting your account will permanently remove all API keys, usage data, and cancel any active subscriptions.
        </p>
        <div className="flex-center gap-12">
          <input
            type="text"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            className="input-field"
            placeholder="Type DELETE"
            style={{ maxWidth: '200px' }}
          />
          <button onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE'} className="btn-danger" style={{ opacity: deleteConfirm !== 'DELETE' ? 0.4 : 1, padding: '10px 24px' }}>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
