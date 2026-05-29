'use client';
import { FaExclamationTriangle, FaCheckCircle, FaEye } from 'react-icons/fa';
import { CondorLogo } from './CondorLogo';

export type RiskLevel = 'red' | 'amber' | 'green';

export interface RiskScoreProps {
  score: number;
  variant?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  withCondor?: boolean;
}

const PALETTE: Record<RiskLevel, { color: string; soft: string; label: string; sub: string; Icon: React.ComponentType<{ size?: number }> }> = {
  red: {
    color: 'var(--danger)',
    soft: 'rgba(239,68,68,0.12)',
    label: 'Riesgo alto',
    sub: 'Revisión inmediata',
    Icon: FaExclamationTriangle,
  },
  amber: {
    color: 'var(--warning)',
    soft: 'rgba(245,158,11,0.14)',
    label: 'Riesgo medio',
    sub: 'Requiere revisión',
    Icon: FaEye,
  },
  green: {
    color: 'var(--success)',
    soft: 'rgba(34,197,94,0.14)',
    label: 'Riesgo bajo',
    sub: 'Todo en calma',
    Icon: FaCheckCircle,
  },
};

const SIZES = {
  sm: { box: 72,  ring: 64,  stroke: 4, fontScore: 18, fontLabel: 10, gap: 4,  condor: 22 },
  md: { box: 132, ring: 116, stroke: 6, fontScore: 32, fontLabel: 13, gap: 8,  condor: 42 },
  lg: { box: 184, ring: 164, stroke: 7, fontScore: 46, fontLabel: 14, gap: 10, condor: 60 },
};

export function RiskScore({
  score,
  variant = 'md',
  label,
  sublabel,
  withCondor = true,
}: RiskScoreProps) {
  const level: RiskLevel = score >= 70 ? 'red' : score >= 40 ? 'amber' : 'green';
  const palette = PALETTE[level];
  const S = SIZES[variant];

  const radius = S.ring / 2 - S.stroke;
  const C = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * C;

  const { Icon } = palette;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: S.gap,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: S.box,
          height: S.box,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: palette.soft,
        }}
      >
        <svg
          width={S.ring}
          height={S.ring}
          style={{
            position: 'absolute',
            inset: (S.box - S.ring) / 2,
            transform: 'rotate(-90deg)',
          }}
        >
          <circle
            cx={S.ring / 2}
            cy={S.ring / 2}
            r={radius}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth={S.stroke}
          />
          <circle
            cx={S.ring / 2}
            cy={S.ring / 2}
            r={radius}
            fill="none"
            stroke={palette.color}
            strokeWidth={S.stroke}
            strokeDasharray={`${dash} ${C}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        </svg>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {withCondor && variant !== 'sm' && (
            <CondorLogo size={S.condor} bg="transparent" rounded={false} />
          )}
          <div
            className="display tabular"
            style={{
              fontSize: S.fontScore,
              fontWeight: 700,
              lineHeight: 1,
              color: palette.color,
              marginTop: withCondor && variant !== 'sm' ? 4 : 0,
            }}
          >
            {score}
            {variant !== 'sm' && (
              <span style={{ fontSize: S.fontScore * 0.4, color: 'var(--text-muted)', fontWeight: 500 }}>
                /100
              </span>
            )}
          </div>
        </div>
      </div>

      {variant !== 'sm' && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: palette.soft,
              color: palette.color,
              fontSize: S.fontLabel,
              fontWeight: 600,
              letterSpacing: '0.01em',
            }}
          >
            <Icon size={12} />
            {label || palette.label}
          </div>
          <div
            style={{
              fontSize: S.fontLabel - 1,
              color: 'var(--text-secondary)',
              marginTop: 4,
            }}
          >
            {sublabel || palette.sub}
          </div>
        </div>
      )}
    </div>
  );
}

export default RiskScore;
