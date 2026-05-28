'use client';
import React from 'react';

interface CondorLogoProps {
  size?: number;
  rounded?: boolean;
  bg?: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * Logo del condor — render del archivo condor-logo.svg (copia en /public).
 * Centraliza el uso del logo para sidebar, avatar del agente, FAB, etc.
 * No deforma: usa object-fit: contain y respeta tamano controlado.
 */
export function CondorLogo({
  size = 36,
  rounded = true,
  bg = '#ffffff',
  className = '',
  style = {},
  title = 'AchachAI',
}: CondorLogoProps) {
  return (
    <img
      src="/condor-logo.svg"
      alt={title}
      width={size}
      height={size}
      className={`condor-logo-img ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? '50%' : 0,
        background: bg,
        objectFit: 'contain',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export default CondorLogo;
