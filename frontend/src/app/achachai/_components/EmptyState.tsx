'use client';
import React from 'react';
import { FaInbox } from 'react-icons/fa';

interface EmptyStateProps {
  icon?: React.ComponentType<{ size?: number }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = FaInbox,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className="empty-state" style={compact ? { padding: '18px 14px' } : undefined}>
      <div className="icon">
        <Icon size={compact ? 18 : 20} />
      </div>
      <div className="title">{title}</div>
      {description && <div className="description">{description}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export default EmptyState;
