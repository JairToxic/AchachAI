'use client';
import React from 'react';

export type ChipTone = 'neutral' | 'red' | 'amber' | 'green' | 'blue' | 'cyan' | 'outline';

interface ChipProps {
  tone?: ChipTone;
  size?: 'sm' | 'md';
  icon?: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Chip({ tone = 'neutral', size = 'sm', icon: Icon, children, style, onClick }: ChipProps) {
  return (
    <span
      className={`chip ${tone === 'neutral' ? '' : tone}`}
      style={{
        fontSize: size === 'sm' ? 11 : 12,
        padding: size === 'sm' ? '3px 9px' : '5px 12px',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
    >
      {Icon && <Icon size={size === 'sm' ? 10 : 12} />}
      {children}
    </span>
  );
}

export default Chip;
