"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { href: "/dashboard/chat", label: "AI Chat", icon: "💬" },
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/keys", label: "API Keys", icon: "🔑" },
  { href: "/dashboard/usage", label: "Usage", icon: "📈" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
  { href: "/dashboard/docs", label: "API Docs", icon: "📖" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push("/login");
          return;
        }
        setUser(data.user);
        setImpersonating(!!data.impersonating);
        setLoading(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function exitImpersonation() {
    await fetch("/api/admin/impersonation/clear", { method: "POST" });
    router.push("/admin");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await signOut({ callbackUrl: "/login", redirect: true });
  }

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="auth-spinner" />
      </div>
    );
  }

  return (
    <div className="dash-shell">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="dash-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`dash-sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Logo */}
        <div className="dash-sidebar-header">
          <Link href="/" className="nav-brand dash-nav-brand">
            AI<span>KOMPUTE</span>
          </Link>
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="dash-sidebar-close"
          >
            ✕
          </button>
        </div>

        <div className="dash-sidebar-label">Developer Portal</div>

        {/* Nav */}
        <nav className="dash-sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`dash-nav-item ${pathname === item.href ? "active" : ""}`}
            >
              <span className="dash-sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="dash-sidebar-user">
          <div className="dash-user-row">
            <div className="dash-avatar">
              {user?.name?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                "?"}
            </div>
            <div className="dash-user-info">
              <div className="dash-user-name">{user?.name || "User"}</div>
              <div className="dash-user-email">{user?.email}</div>
            </div>
          </div>
          <div className="dash-user-actions">
            <span className="dash-plan-badge">
              {user?.plan?.name || "Free"}
            </span>
            <button onClick={handleLogout} className="dash-logout">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">
        {/* Mobile Header */}
        <div className="dash-mobile-header">
          <button
            onClick={() => setSidebarOpen(true)}
            className="dash-menu-btn"
            aria-label="Open menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link href="/" className="nav-brand dash-nav-brand-mobile">
            AI<span>KOMPUTE</span>
          </Link>
          <div className="dash-mobile-spacer" />
        </div>

        {impersonating && (
          <div className="dash-impersonation-bar">
            <div>
              <span className="dash-impersonation-label">Impersonation</span>
              You are viewing this account as {user?.email}.
            </div>
            <button
              onClick={exitImpersonation}
              className="btn-border btn-small"
            >
              Exit impersonation
            </button>
          </div>
        )}
        <div className="dash-content">{children}</div>
      </main>
    </div>
  );
}
