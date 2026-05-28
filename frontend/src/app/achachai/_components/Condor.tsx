'use client';
import { useEffect, useState } from 'react';
import { TriangleAlert } from './TriangleAlert';
import { CondorLogo } from './CondorLogo';

const TONE = {
  wing:   { body: "#0B3A75", accent: "#1565C0", beak: "#06B6D4", collar: "#E0F2FE", eye: "#F8FAFC" },
  marfil: { body: "#E0F2FE", accent: "#67E8F9", beak: "#06B6D4", collar: "#1565C0", eye: "#0B1E33" },
  orange: { body: "#06B6D4", accent: "#0891B2", beak: "#0B3A75", collar: "#E0F2FE", eye: "#F8FAFC" },
  red:    { body: "#EF4444", accent: "#B91C1C", beak: "#FCD34D", collar: "#FEE2E2", eye: "#FFF1F2" },
  green:  { body: "#22C55E", accent: "#15803D", beak: "#06B6D4", collar: "#DCFCE7", eye: "#F8FAFC" },
  blue:   { body: "#1565C0", accent: "#0B3A75", beak: "#06B6D4", collar: "#E0F2FE", eye: "#F8FAFC" },
} as const;

type Mood = 'idle' | 'think' | 'speak' | 'alert' | 'still';
type Tone = keyof typeof TONE;

export interface CondorProps {
  size?: number;
  mood?: Mood;
  tone?: Tone;
  className?: string;
  style?: React.CSSProperties;
  sonar?: boolean;
}

export function Condor({ size = 32, mood = 'idle', tone = 'wing', className = '', style = {}, sonar = false }: CondorProps) {
  const c = TONE[tone] || TONE.wing;

  const bodyAnim = {
    idle:  "condor-soar 5.2s ease-in-out infinite",
    think: "condor-think 1.4s ease-in-out infinite",
    speak: "condor-speak 1.6s ease-in-out infinite",
    alert: "condor-dive 1.1s ease-in-out infinite, feather-glow 1.1s ease-in-out infinite",
    still: "none",
  }[mood];

  const wingLAnim = {
    idle:  "wing-soar-left 5.2s ease-in-out infinite",
    think: "wing-flap-left 1.0s ease-in-out infinite",
    speak: "wing-soar-left 2.4s ease-in-out infinite",
    alert: "wing-dive-left 1.1s ease-in-out infinite",
    still: "none",
  }[mood];

  const wingRAnim = {
    idle:  "wing-soar-right 5.2s ease-in-out infinite",
    think: "wing-flap-right 1.0s ease-in-out infinite",
    speak: "wing-soar-right 2.4s ease-in-out infinite",
    alert: "wing-dive-right 1.1s ease-in-out infinite",
    still: "none",
  }[mood];

  const headAnim = {
    idle:  "head-tilt 6s ease-in-out infinite",
    think: "head-tilt 2.4s ease-in-out infinite",
    speak: "head-tilt 1.2s ease-in-out infinite",
    alert: "none",
    still: "none",
  }[mood];

  const beakAnim = mood === 'speak' ? "beak-open 0.5s ease-in-out infinite" : "none";
  const eyeAnim  = "blink 5s infinite";
  const tailAnim = (mood === 'idle' || mood === 'speak') ? "tail-sway 4s ease-in-out infinite" : "none";

  const showSonar = sonar || mood === 'alert';

  return (
    <svg
      width={size} height={size} viewBox="-10 -10 100 100"
      className={className}
      style={{ display: "inline-block", overflow: "visible", ...style }}
      aria-hidden="true"
    >
      {showSonar && (
        <g style={{ transformOrigin: "40px 50px" }}>
          <circle cx="40" cy="50" r="32" fill="none" stroke="#EF4444" strokeWidth="1.2"
                  style={{ transformOrigin: "40px 50px", animation: "sonar-out 1.6s ease-out infinite" }}/>
          <circle cx="40" cy="50" r="32" fill="none" stroke="#EF4444" strokeWidth="1.2"
                  style={{ transformOrigin: "40px 50px", animation: "sonar-out 1.6s ease-out infinite 0.55s" }}/>
        </g>
      )}
      <g style={{ transformOrigin: "40px 50px", animation: bodyAnim }}>
        <g style={{ transformOrigin: "40px 64px", animation: tailAnim }}>
          <path d="M34 60 L40 78 L46 60 Z" fill={c.accent}/>
          <line x1="40" y1="78" x2="40" y2="64" stroke={c.body} strokeWidth="0.6" opacity="0.4"/>
        </g>
        <g style={{ transformOrigin: "28px 46px", animation: wingLAnim }}>
          <path d="M28 46 C 14 38, 4 44, -4 56 C 6 52, 16 50, 24 54 C 18 56, 12 60, 8 66 C 18 60, 26 56, 30 54 Z" fill={c.body}/>
          <path d="M28 46 C 18 40, 8 42, 2 50 C 12 46, 22 46, 28 48 Z" fill={c.accent} opacity="0.85"/>
          <path d="M24 50 L 14 56" stroke={c.accent} strokeWidth="0.6" opacity="0.5"/>
          <path d="M22 52 L 10 60" stroke={c.accent} strokeWidth="0.6" opacity="0.5"/>
        </g>
        <g style={{ transformOrigin: "52px 46px", animation: wingRAnim }}>
          <path d="M52 46 C 66 38, 76 44, 84 56 C 74 52, 64 50, 56 54 C 62 56, 68 60, 72 66 C 62 60, 54 56, 50 54 Z" fill={c.body}/>
          <path d="M52 46 C 62 40, 72 42, 78 50 C 68 46, 58 46, 52 48 Z" fill={c.accent} opacity="0.85"/>
          <path d="M56 50 L 66 56" stroke={c.accent} strokeWidth="0.6" opacity="0.5"/>
          <path d="M58 52 L 70 60" stroke={c.accent} strokeWidth="0.6" opacity="0.5"/>
        </g>
        <ellipse cx="40" cy="52" rx="11" ry="14" fill={c.body}/>
        <ellipse cx="38" cy="50" rx="6" ry="9" fill={c.accent} opacity="0.4"/>
        <ellipse cx="40" cy="40" rx="9" ry="3.5" fill={c.collar}/>
        <ellipse cx="40" cy="40" rx="9" ry="3.5" fill="none" stroke={c.body} strokeWidth="0.5" opacity="0.3"/>
        <path d="M37 64 L36 70 M37 64 L38 70 M37 64 L39 69" stroke={c.accent} strokeWidth="0.8" fill="none"/>
        <path d="M43 64 L42 69 M43 64 L44 70 M43 64 L45 70" stroke={c.accent} strokeWidth="0.8" fill="none"/>
        <g style={{ transformOrigin: "40px 38px", animation: headAnim }}>
          <path d="M37 40 L 36 34 L 44 34 L 43 40 Z" fill={c.body}/>
          <ellipse cx="40" cy="30" rx="6" ry="7" fill={c.body}/>
          <ellipse cx="40" cy="26" rx="4.5" ry="3" fill={c.accent} opacity="0.7"/>
          <path d="M40 22 Q 41 20, 42 22" stroke={c.accent} strokeWidth="0.7" fill="none"/>
          <g style={{ transformOrigin: "42.5px 29px", animation: eyeAnim }}>
            <ellipse cx="42.5" cy="29" rx="1.4" ry="1.4" fill={c.eye}/>
            <ellipse cx="42.7" cy="29" rx="0.7" ry="0.9" fill={c.body}/>
          </g>
          <g style={{ transformOrigin: "44px 31px", animation: beakAnim }}>
            <path d="M43 31 L 48 32 Q 49 33, 47 34 L 44 33 Z" fill={c.beak}/>
            <path d="M47 33 L 48.5 34.5" stroke={c.beak} strokeWidth="0.8" fill="none"/>
          </g>
        </g>
      </g>
    </svg>
  );
}

export function CondorMini({ size = 14, tone = 'wing' as Tone }) {
  const c = TONE[tone] || TONE.wing;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "-2px" }}>
      <path d="M2 14 L8 10 L12 12 L16 10 L22 14 L18 13 L14 12 L12 14 L10 12 L6 13 Z" fill={c.body}/>
      <circle cx="12" cy="9" r="1.6" fill={c.body}/>
      <path d="M13 9 L15 10 L13 10.5 Z" fill={c.beak}/>
    </svg>
  );
}

export function CondorOverPeaks({ width = 120, mood = 'idle' as Mood }) {
  return (
    <svg viewBox="0 0 220 90" width={width} style={{ display: "block" }}>
      <defs>
        <linearGradient id="sky-dawn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#F5A39C" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#020617" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect width="220" height="90" fill="url(#sky-dawn)"/>
      <circle cx="170" cy="22" r="11" fill="#E87A4F" opacity="0.30"/>
      <path d="M0 80 L30 45 L55 65 L95 25 L135 60 L170 40 L220 65 L220 90 L0 90 Z" fill="#2C5F8D" opacity="0.20"/>
      <path d="M0 88 L40 60 L80 75 L120 52 L160 70 L220 60 L220 90 L0 90 Z" fill="#1A3A52" opacity="0.18"/>
      <g transform="translate(60 18)">
        <Condor size={42} tone="wing" mood={mood}/>
      </g>
    </svg>
  );
}

export interface VueloDelCondorProps {
  score?: number;
  variant?: 'sm' | 'md' | 'lg' | 'cinema';
  label?: string;
  sublabel?: string;
  signals?: string[];
}

export function VueloDelCondor({ score = 14, variant = 'md', label, sublabel, signals = [] }: VueloDelCondorProps) {
  const level = score >= 70 ? 'red' : score >= 40 ? 'amber' : 'green';
  const palette = {
    red: {
      ring: "#EF4444",
      soft: "radial-gradient(circle at 50% 50%, rgba(2, 6, 23, 0.85) 0%, rgba(7, 20, 38, 0.92) 70%)",
      glow: "0 0 22px rgba(239, 68, 68, 0.22), inset 0 0 30px rgba(2, 6, 23, 0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      text: "Riesgo alto", desc: "Revisión inmediata",
      mood: 'alert' as Mood, tone: 'red' as Tone,
      spin: 6,
    },
    amber: {
      ring: "#F59E0B",
      soft: "radial-gradient(circle at 50% 50%, rgba(2, 6, 23, 0.82) 0%, rgba(7, 20, 38, 0.92) 70%)",
      glow: "0 0 18px rgba(245, 158, 11, 0.18), inset 0 0 26px rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
      text: "Observación", desc: "Requiere revisión",
      mood: 'think' as Mood, tone: 'blue' as Tone,
      spin: 10,
    },
    green: {
      ring: "#22C55E",
      soft: "radial-gradient(circle at 50% 50%, rgba(2, 6, 23, 0.82) 0%, rgba(7, 20, 38, 0.92) 70%)",
      glow: "0 0 16px rgba(34, 197, 94, 0.16), inset 0 0 26px rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
      text: "Vuelo alto", desc: "Todo en calma",
      mood: 'idle' as Mood, tone: 'wing' as Tone,
      spin: 16,
    },
  }[level];

  const sizeMap = {
    sm:     { box: 64,  ring: 56,  score: 18, condor: 22 },
    md:     { box: 130, ring: 112, score: 32, condor: 50 },
    lg:     { box: 200, ring: 172, score: 52, condor: 78 },
    cinema: { box: 340, ring: 296, score: 96, condor: 130 },
  };
  const S = sizeMap[variant] || sizeMap.md;
  const C = 2 * Math.PI * (S.ring / 2 - 6);
  const dash = (score / 100) * C;
  const gradId = `vuelo-ring-${level}-${variant}`;

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: variant === 'sm' ? 4 : 8 }}>
      <div className={`vuelo-score vuelo-score-${level}`} style={{
        position: "relative", width: S.box, height: S.box,
        display: "grid", placeItems: "center",
        borderRadius: "50%",
        background: palette.soft,
        boxShadow: palette.glow,
      }}>
        <svg className="vuelo-ring" width={S.ring} height={S.ring} style={{
          position: "absolute", inset: (S.box - S.ring) / 2,
          filter: `drop-shadow(0 0 6px ${palette.ring}66)`,
          animation: `spin-slow ${palette.spin}s linear infinite`,
        }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={palette.ring} stopOpacity="0.95"/>
              <stop offset="100%" stopColor={palette.ring} stopOpacity="0.55"/>
            </linearGradient>
          </defs>
          <circle cx={S.ring / 2} cy={S.ring / 2} r={S.ring / 2 - 6} fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="3"/>
          <circle cx={S.ring / 2} cy={S.ring / 2} r={S.ring / 2 - 6} fill="none" stroke={`url(#${gradId})`} strokeWidth="3.5"
                  strokeDasharray={`${dash} ${C}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .6s ease" }}/>
        </svg>
        {level === 'red' && variant !== 'sm' && (
          <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "1px solid rgba(239, 68, 68, 0.18)", pointerEvents: "none" }}/>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ display: 'inline-flex' }}>
            <TriangleAlert size={Math.round(S.condor * 0.72)} level={level} glow={variant !== 'sm'}/>
          </div>
          {variant !== 'sm' && (
            <div className="tabular display" style={{
              fontSize: S.score,
              fontWeight: 700,
              lineHeight: 1,
              color: palette.ring,
              marginTop: variant === 'cinema' ? 12 : 6,
              textShadow: `0 0 14px ${palette.ring}40`,
              letterSpacing: '-0.03em',
            }}>
              {score}<span style={{ fontSize: S.score * 0.4, color: "var(--text-muted)", fontWeight: 500 }}>/100</span>
            </div>
          )}
          {variant === 'sm' && (
            <div className="tabular display" style={{
              fontSize: 12, fontWeight: 700, color: palette.ring, marginTop: 1, letterSpacing: '-0.02em',
            }}>{score}</div>
          )}
        </div>
      </div>
      {variant !== 'sm' && (
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{
            fontSize: variant === 'cinema' ? 22 : 13,
            fontWeight: 600,
            color: palette.ring,
            letterSpacing: "-0.01em",
          }}>
            {label || palette.text}
          </div>
          <div style={{ fontSize: variant === 'cinema' ? 13 : 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>
            {sublabel || palette.desc}
          </div>
        </div>
      )}
      {signals.length > 0 && variant !== 'sm' && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", maxWidth: S.box + 60 }}>
          {signals.slice(0, 5).map((s, i) => (
            <span key={i} className={`chip ${level}`} style={{ fontSize: 10, padding: "2px 7px" }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CondorBubble({ onOpen, mood = 'idle' as Mood, message }: { onOpen?: () => void; mood?: Mood; message?: string | null }) {
  const [showMsg, setShowMsg] = useState(false);
  useEffect(() => {
    if (message) {
      setShowMsg(true);
      const t = setTimeout(() => setShowMsg(false), 9000);
      return () => clearTimeout(t);
    }
  }, [message]);

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      {showMsg && message && (
        <div className="fade-up" style={{
          maxWidth: 280,
          background: "rgba(7, 20, 38, 0.92)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(6, 182, 212, 0.35)",
          padding: "12px 16px", borderRadius: 16,
          boxShadow: "0 20px 50px rgba(2,6,23,0.55), 0 0 24px rgba(6, 182, 212, 0.18)",
          fontSize: 12.5, color: "var(--text-primary)", position: "relative",
        }}>
          <div style={{ fontSize: 10, color: "#22D3EE", fontWeight: 700, marginBottom: 5, letterSpacing: ".14em" }}>EL CÓNDOR DICE</div>
          {message}
          <div style={{ position: "absolute", bottom: -6, right: 24, width: 12, height: 12, background: "rgba(7, 20, 38, 0.92)", borderRight: "1px solid rgba(6, 182, 212, 0.35)", borderBottom: "1px solid rgba(6, 182, 212, 0.35)", transform: "rotate(45deg)" }}/>
        </div>
      )}
      <button
        onClick={onOpen}
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: mood === 'alert'
            ? "linear-gradient(135deg, #EF4444, #B91C1C)"
            : "linear-gradient(135deg, #0c72e7, #a9e9f5)",
          border: "2px solid rgba(6, 182, 212, 0.55)",
          boxShadow: mood === 'alert'
            ? "0 0 32px rgba(239, 68, 68, 0.55), 0 12px 30px rgba(2,6,23,0.55)"
            : "0 0 32px rgba(6, 182, 212, 0.45), 0 12px 30px rgba(2,6,23,0.55)",
          display: "grid", placeItems: "center", color: "#F8FAFC", position: "relative",
          animation: mood === 'alert' ? "pulse-red 1.2s infinite" : "none",
          cursor: "pointer",
        }}
        aria-label="Hablar con el cóndor"
      >
        <CondorLogo size={46}/>
        {mood === 'alert' && (
          <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#EF4444", border: "2px solid #020617", boxShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}/>
        )}
      </button>
    </div>
  );
}

export function LearningBar({ count = 47, delta = 2.3 }: { count?: number; delta?: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 20px",
      background: "linear-gradient(90deg, rgba(6, 182, 212, 0.08), rgba(21, 101, 192, 0.10))",
      borderBottom: "1px solid rgba(6, 182, 212, 0.18)",
      fontSize: 12,
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
    }}>
      <div style={{ position: "relative", width: 28, height: 28, display: "grid", placeItems: "center" }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "1.5px solid #06B6D4", borderTopColor: "transparent",
          animation: "spin-slow 4s linear infinite",
          boxShadow: "0 0 10px rgba(6, 182, 212, 0.45)",
        }}/>
        <Condor size={16} tone="orange" mood="idle"/>
      </div>
      <div>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>El cóndor aprendió de {count} decisiones tuyas esta semana.</span>
        <span style={{ color: "#34D399", fontWeight: 700, marginLeft: 8, textShadow: "0 0 8px rgba(34, 197, 94, 0.40)" }}>↑ {delta} pts de precisión</span>
        <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>· Gracias.</span>
      </div>
      <div style={{ flex: 1 }}/>
      <button className="chip blue" style={{ cursor: "pointer" }}>Ver detalle →</button>
    </div>
  );
}
