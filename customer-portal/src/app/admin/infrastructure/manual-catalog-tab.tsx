"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, RefreshCw, Search } from "lucide-react";

type InventoryEntry = {
  id: string;
  rootId: string;
  canonicalId: string;
  providerId: string;
  alias: string;
  type: string;
  eligible: boolean;
  exclusionReason: string | null;
  inVirtualCatalog: boolean;
  override: "included" | "excluded" | null;
};

type CatalogData = {
  enabled: boolean;
  inventory: InventoryEntry[];
  totalProviderModels: number;
};

function ModelTargetRow({
  entry,
  side,
  moving,
  onMove,
}: {
  entry: InventoryEntry;
  side: "available" | "virtual";
  moving: boolean;
  onMove: (entry: InventoryEntry, included: boolean) => void;
}) {
  const disabled = moving || (side === "available" && !entry.eligible);
  return (
    <button
      type="button"
      disabled={disabled}
      onDoubleClick={() => !disabled && onMove(entry, side === "available")}
      className="border-default bg-surface w-full"
      style={{
        padding: "10px 12px",
        textAlign: "left",
        color: "var(--text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
      title={
        !entry.eligible
          ? `Cannot add: ${entry.exclusionReason || "not eligible"}`
          : `Double-click to move ${side === "available" ? "into" : "out of"} the virtual catalog`
      }
    >
      <div className="flex-between gap-12">
        <code className="mono text-12 text-bright truncate">
          {entry.rootId}
        </code>
        <span
          className={`badge ${entry.override ? "badge-accent" : ""}`}
          style={{ fontSize: "8px", flexShrink: 0 }}
        >
          {moving ? "moving…" : entry.alias || entry.providerId}
        </span>
      </div>
      <div className="flex-between gap-8" style={{ marginTop: "5px" }}>
        <span className="mono text-10 text-muted truncate">{entry.id}</span>
        <span className="mono text-9 text-muted" style={{ flexShrink: 0 }}>
          {entry.eligible ? entry.canonicalId : entry.exclusionReason}
        </span>
      </div>
    </button>
  );
}

export default function ManualCatalogTab() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/virtual-catalog", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load provider inventory");
      setData(await response.json());
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to load provider inventory",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const entries = data?.inventory || [];
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      [
        entry.id,
        entry.rootId,
        entry.canonicalId,
        entry.providerId,
        entry.alias,
        entry.type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data, search]);

  const available = useMemo(
    () => filtered.filter((entry) => !entry.inVirtualCatalog),
    [filtered],
  );
  const virtual = useMemo(
    () => filtered.filter((entry) => entry.inVirtualCatalog),
    [filtered],
  );

  const moveModel = async (entry: InventoryEntry, included: boolean) => {
    setMovingId(entry.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/virtual-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "membership",
          modelId: entry.id,
          included,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
            result?.error ||
            "Failed to update membership",
        );
      }
      setMessage(
        `${entry.id} moved ${included ? "into" : "out of"} the virtual catalog.`,
      );
      await fetchData();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to update membership",
      );
    } finally {
      setMovingId("");
    }
  };

  if (loading && !data) {
    return (
      <div
        className="flex-center justify-center"
        style={{ minHeight: "calc(100vh - 120px)" }}
      >
        <div className="auth-spinner" />
      </div>
    );
  }

  return (
    <div
      className="bg-bg"
      style={{ minHeight: "calc(100vh - 56px)", color: "var(--text)" }}
    >
      <div
        style={{ maxWidth: "1480px", margin: "0 auto", padding: "0 24px 48px" }}
      >
        <div className="dash-page-header flex-start flex-wrap gap-20 justify-between">
          <div>
            <div
              className="badge badge-accent mb-8"
              style={{ fontSize: "9px" }}
            >
              Manual Catalog
            </div>
            <h1 className="dash-page-title">Provider target membership</h1>
            <p className="dash-page-sub">
              Double-click an eligible provider model to move it between the
              discovered inventory and the current virtual catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="btn-outline btn-sm inline-flex items-center gap-6"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
        </div>

        {error && <div className="alert-error mb-16">{error}</div>}
        {message && <div className="alert-success mb-16">{message}</div>}

        <div className="dash-card mb-20">
          <div className="flex-between gap-16 flex-wrap">
            <div className="flex-center gap-8" style={{ flex: "1 1 360px" }}>
              <Search size={14} style={{ color: "var(--muted)" }} />
              <input
                type="text"
                className="input-field"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search model, provider, alias, or canonical ID…"
                style={{ width: "100%" }}
              />
            </div>
            <div className="flex-center gap-8 text-11 text-muted mono">
              <span>{data?.totalProviderModels || 0} discovered targets</span>
              <span>·</span>
              <span>{virtual.length} active targets</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 48px minmax(0, 1fr)",
            gap: "12px",
            alignItems: "start",
          }}
        >
          <div className="dash-card mb-0">
            <div className="dash-card-title flex-between">
              <span>All Provider Models</span>
              <span className="badge">{available.length}</span>
            </div>
            <p className="text-11 text-muted mb-12">
              Double-click an eligible row to add that exact provider target.
              Non-text targets remain visible but disabled.
            </p>
            <div
              className="flex flex-col gap-6"
              style={{ maxHeight: "680px", overflowY: "auto" }}
            >
              {available.map((entry) => (
                <ModelTargetRow
                  key={entry.id}
                  entry={entry}
                  side="available"
                  moving={movingId === entry.id}
                  onMove={moveModel}
                />
              ))}
              {available.length === 0 && (
                <p
                  className="text-12 text-muted text-center"
                  style={{ padding: "40px 0" }}
                >
                  No available models match this search.
                </p>
              )}
            </div>
          </div>

          <div
            className="flex-center justify-center"
            style={{ paddingTop: "120px", color: "var(--accent)" }}
          >
            <ArrowLeftRight size={22} />
          </div>

          <div className="dash-card mb-0">
            <div className="dash-card-title flex-between">
              <span>Current Virtual Model Targets</span>
              <span className="badge badge-accent">{virtual.length}</span>
            </div>
            <p className="text-11 text-muted mb-12">
              Double-click a row to remove that provider target. The virtual
              model remains when another provider target still backs it.
            </p>
            <div
              className="flex flex-col gap-6"
              style={{ maxHeight: "680px", overflowY: "auto" }}
            >
              {virtual.map((entry) => (
                <ModelTargetRow
                  key={entry.id}
                  entry={entry}
                  side="virtual"
                  moving={movingId === entry.id}
                  onMove={moveModel}
                />
              ))}
              {virtual.length === 0 && (
                <p
                  className="text-12 text-muted text-center"
                  style={{ padding: "40px 0" }}
                >
                  No virtual targets match this search.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
