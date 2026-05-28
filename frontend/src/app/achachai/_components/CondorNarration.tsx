'use client';
import React from 'react';
import { FaInfoCircle, FaExclamationTriangle, FaLightbulb } from 'react-icons/fa';
import { CondorLogo } from './CondorLogo';

export interface NarrationItem {
  title: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'danger' | 'warning' | 'info';
}

interface CondorNarrationProps {
  intro: React.ReactNode;
  items: NarrationItem[];
  suggestion?: React.ReactNode;
  suggestionTone?: 'primary' | 'warning' | 'danger';
}

const ITEM_ICON: Record<NonNullable<NarrationItem['tone']>, { Icon: React.ComponentType<{ size?: number }>; color: string }> = {
  danger:  { Icon: FaExclamationTriangle, color: 'var(--danger)' },
  warning: { Icon: FaExclamationTriangle, color: 'var(--warning)' },
  info:    { Icon: FaInfoCircle,          color: 'var(--accent)' },
};

const SUGG_STYLE: Record<NonNullable<CondorNarrationProps['suggestionTone']>, { border: string; bg: string; color: string }> = {
  primary: { border: 'var(--primary)', bg: 'var(--primary-soft)', color: 'var(--primary)' },
  warning: { border: 'var(--warning)', bg: 'var(--warning-soft)', color: '#8B5E2B' },
  danger:  { border: 'var(--danger)',  bg: 'var(--danger-soft)',  color: 'var(--danger)' },
};

export function CondorNarration({
  intro,
  items,
  suggestion,
  suggestionTone = 'primary',
}: CondorNarrationProps) {
  const sugg = SUGG_STYLE[suggestionTone];

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <CondorLogo size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.16em',
              color: 'var(--accent)',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            El cóndor te narra
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--text-primary)',
            }}
          >
            {intro}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => {
          const tone = ITEM_ICON[it.tone || 'info'];
          const Icon = tone.Icon;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '8px 10px',
                background: 'var(--bg-card-soft)',
                borderRadius: 8,
                border: '1px solid var(--border-soft)',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                  color: tone.color,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={12} />
              </span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                <div style={{ fontWeight: 600 }}>{it.title}</div>
                {it.detail && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {it.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {suggestion && (
        <div
          style={{
            padding: '10px 12px',
            background: sugg.bg,
            borderRadius: 10,
            borderLeft: `3px solid ${sugg.border}`,
            fontSize: 12.5,
            color: sugg.color,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <FaLightbulb size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700 }}>Sugerencia:</span> {suggestion}
          </div>
        </div>
      )}
    </div>
  );
}

export default CondorNarration;
