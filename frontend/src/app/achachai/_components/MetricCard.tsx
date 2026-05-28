'use client';
import React from 'react';

export type MetricTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

interface MetricCardProps {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: MetricTone;
  trend?: React.ReactNode;
  big?: boolean;
}

const TONE_MAP: Record<MetricTone, { fg: string; bg: string }> = {
  primary: { fg: 'var(--primary)', bg: 'var(--primary-soft)' },
  accent:  { fg: 'var(--accent)',  bg: 'var(--accent-soft)' },
  success: { fg: 'var(--success)', bg: 'var(--success-soft)' },
  warning: { fg: 'var(--warning)', bg: 'var(--warning-soft)' },
  danger:  { fg: 'var(--danger)',  bg: 'var(--danger-soft)' },
  neutral: { fg: 'var(--text-primary)', bg: 'var(--bg-subtle)' },
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'primary',
  trend,
  big = false,
}: MetricCardProps) {
  const t = TONE_MAP[tone];
  return (
    <div
      className="card"
      style={{
        padding: big ? '20px 22px' : '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: t.bg,
            color: t.fg,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
        {trend}
      </div>
      <div
        className="display tabular"
        style={{
          fontSize: big ? 36 : 26,
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
