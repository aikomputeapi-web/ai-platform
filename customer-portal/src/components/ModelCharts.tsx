'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { ScatterShapeProps } from 'recharts';
import type { ModelMetric } from '@/lib/artificialanalysis';

// ── Shared tooltip styles ─────────────────────────────────────────────────────

const TooltipStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #2a2a40',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '12px',
  color: '#e2e8f0',
};

// ── Custom tooltip inner component (avoids TooltipProps payload issue) ────────

interface TooltipPayloadItem {
  payload?: ModelMetric | ScatterPoint;
}

// ── Speed Bar Chart ───────────────────────────────────────────────────────────

interface SpeedChartProps {
  data: ModelMetric[];
}

function SpeedTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ModelMetric;
  if (!d) return null;
  return (
    <div style={TooltipStyle}>
      <p className="font-bold mb-1">{d.name}</p>
      <p style={{ color: '#94a3b8' }}>{d.provider}</p>
      <p style={{ color: '#4ade80' }} className="font-semibold mt-1">
        {d.outputSpeed} tok/s
      </p>
    </div>
  );
}

export function SpeedChart({ data }: SpeedChartProps) {
  const sorted = [...data].sort((a, b) => b.outputSpeed - a.outputSpeed).slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
        barSize={18}
      >
        <XAxis
          type="number"
          dataKey="outputSpeed"
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter, system-ui' }}
          tickLine={false}
          axisLine={false}
          unit=" t/s"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, system-ui' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + '…' : v)}
        />
        <Tooltip
          content={(props) => (
            <SpeedTooltipContent
              active={props.active}
              payload={props.payload as unknown as TooltipPayloadItem[]}
            />
          )}
          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
        />
        <Bar dataKey="outputSpeed" radius={[0, 4, 4, 0]}>
          {sorted.map((entry, i) => (
            <Cell key={i} fill={entry.color + 'cc'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Price Bar Chart ───────────────────────────────────────────────────────────

interface PriceChartProps {
  data: ModelMetric[];
}

function PriceTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ModelMetric;
  if (!d) return null;
  return (
    <div style={TooltipStyle}>
      <p className="font-bold mb-1">{d.name}</p>
      <p style={{ color: '#94a3b8' }}>{d.provider}</p>
      <p style={{ color: '#818cf8' }} className="font-semibold mt-1">
        ${d.blendedPrice.toFixed(2)}/1M tokens
      </p>
    </div>
  );
}

export function PriceChart({ data }: PriceChartProps) {
  const sorted = [...data]
    .filter((d) => d.blendedPrice > 0)
    .sort((a, b) => a.blendedPrice - b.blendedPrice)
    .slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
        barSize={18}
      >
        <XAxis
          type="number"
          dataKey="blendedPrice"
          tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter, system-ui' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, system-ui' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + '…' : v)}
        />
        <Tooltip
          content={(props) => (
            <PriceTooltipContent
              active={props.active}
              payload={props.payload as unknown as TooltipPayloadItem[]}
            />
          )}
          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
        />
        <Bar dataKey="blendedPrice" radius={[0, 4, 4, 0]}>
          {sorted.map((entry, i) => (
            <Cell key={i} fill={entry.color + 'cc'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Scatter: Intelligence vs Price ────────────────────────────────────────────

interface ScatterPlotProps {
  data: ModelMetric[];
}

interface ScatterPoint {
  x: number; // blendedPrice
  y: number; // intelligenceScore
  name: string;
  provider: string;
  color: string;
}

function ScatterTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ScatterPoint;
  if (!d) return null;
  return (
    <div style={TooltipStyle}>
      <p className="font-bold mb-1">{d.name}</p>
      <p style={{ color: '#94a3b8' }} className="mb-2">
        {d.provider}
      </p>
      <p style={{ color: '#818cf8' }}>
        Intelligence: <span className="font-bold text-white">{d.y}</span>
      </p>
      <p style={{ color: '#4ade80' }}>
        Price: <span className="font-bold text-white">${d.x.toFixed(2)}/1M</span>
      </p>
    </div>
  );
}

// Custom dot renderer for the scatter plot — typed with recharts ScatterShapeProps
function ScatterDot(props: ScatterShapeProps): React.ReactElement | null {
  const { cx, cy } = props;
  const payload = (props as unknown as { payload?: ScatterPoint }).payload;
  if (!payload || cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill={payload.color + 'dd'}
      stroke={payload.color}
      strokeWidth={1.5}
    />
  );
}

export function IntelligenceVsPriceChart({ data }: ScatterPlotProps) {
  const points: ScatterPoint[] = data
    .filter((d) => d.intelligenceScore > 0 && d.blendedPrice > 0)
    .map((d) => ({
      x: d.blendedPrice,
      y: d.intelligenceScore,
      name: d.name,
      provider: d.provider,
      color: d.color,
    }));

  const providers = [...new Set(points.map((p) => p.provider))];

  return (
    <div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" />
          <XAxis
            type="number"
            dataKey="x"
            name="Price"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter, system-ui' }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a40' }}
            tickFormatter={(v: number) => `$${v}`}
            label={{
              value: 'Price ($/1M tokens)',
              position: 'insideBottom',
              offset: -12,
              fill: '#64748b',
              fontSize: 10,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Intelligence"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Inter, system-ui' }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a40' }}
            label={{
              value: 'Intelligence Score',
              angle: -90,
              position: 'insideLeft',
              offset: 12,
              fill: '#64748b',
              fontSize: 10,
            }}
          />
          <Tooltip
            content={(props) => (
              <ScatterTooltipContent
                active={props.active}
                payload={props.payload as unknown as TooltipPayloadItem[]}
              />
            )}
            cursor={{ strokeDasharray: '3 3', stroke: '#6366f1' }}
          />
          {/* Value-zone reference lines */}
          <ReferenceLine
            x={2}
            stroke="#6366f133"
            strokeDasharray="4 4"
            label={{ value: 'Budget', fill: '#64748b', fontSize: 9, position: 'top' }}
          />
          <ReferenceLine
            y={50}
            stroke="#6366f133"
            strokeDasharray="4 4"
            label={{ value: 'Top tier', fill: '#64748b', fontSize: 9, position: 'right' }}
          />
          <Scatter
            name="Models"
            data={points}
            shape={ScatterDot}
          />
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {providers.map((prov) => {
          const point = points.find((p) => p.provider === prov);
          return (
            <div key={prov} className="flex items-center gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: point?.color ?? '#6366f1' }}
              />
              {prov}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Leaderboard bar row (renders inside async server component) ───────────────

interface LeaderboardBarProps {
  name: string;
  provider: string;
  score: number;
  maxScore: number;
  color: string;
  rank: number;
  available?: boolean;
}

export function LeaderboardBar({
  name,
  provider,
  score,
  maxScore,
  color,
  rank,
  available = true,
}: LeaderboardBarProps) {
  return (
    <div className="flex items-center gap-4 group">
      <span className="text-xs text-[var(--color-text-muted)] w-4 font-mono flex-shrink-0">
        {rank}
      </span>
      <div className="w-36 flex-shrink-0">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{provider}</p>
      </div>
      <div className="flex-1 h-7 bg-[var(--color-border)] rounded-lg overflow-hidden">
        <div
          className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
          style={{
            width: `${(score / maxScore) * 100}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
        >
          <span className="text-xs font-bold text-white">{score}</span>
        </div>
      </div>
      <div className="w-24 flex-shrink-0 text-right">
        {available ? (
          <span className="text-xs text-green-400 font-semibold">✓ Available</span>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">Coming soon</span>
        )}
      </div>
    </div>
  );
}
