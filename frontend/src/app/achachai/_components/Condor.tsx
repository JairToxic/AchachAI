'use client';
import { useEffect, useState } from 'react';

const TONE = {
  wing:   { body: "#1A3A52", accent: "#2C5F8D", beak: "#E87A4F", collar: "#F4EDE4", eye: "#F4EDE4" },
  marfil: { body: "#F4EDE4", accent: "#EBDFCC", beak: "#E87A4F", collar: "#D4A574", eye: "#1A3A52" },
  orange: { body: "#E87A4F", accent: "#C5333A", beak: "#1A3A52", collar: "#F4EDE4", eye: "#F4EDE4" },
  red:    { body: "#C5333A", accent: "#7A1F25", beak: "#1A3A52", collar: "#F4EDE4", eye: "#F4EDE4" },
  green:  { body: "#4A7C59", accent: "#2F5740", beak: "#E87A4F", collar: "#F4EDE4", eye: "#F4EDE4" },
  blue:   { body: "#2C5F8D", accent: "#1F4A73", beak: "#E87A4F", collar: "#F4EDE4", eye: "#F4EDE4" },
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
          <circle cx="40" cy="50" r="32" fill="none" stroke="#C5333A" strokeWidth="1.2"
                  style={{ transformOrigin: "40px 50px", animation: "sonar-out 1.6s ease-out infinite" }}/>
          <circle cx="40" cy="50" r="32" fill="none" stroke="#C5333A" strokeWidth="1.2"
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
          <stop offset="100%" stopColor="#F4EDE4" stopOpacity="0"/>
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
    red:   { ring: "#C5333A", soft: "rgba(197,51,58,0.16)", text: "Descenso",     desc: "Revisión inmediata", anim: "pulse-red 1s infinite",   mood: 'alert' as Mood, tone: 'red' as Tone   },
    amber: { ring: "#D4A574", soft: "rgba(212,165,116,0.20)", text: "Observación", desc: "Requiere revisión",  anim: "pulse-amber 2s infinite", mood: 'think' as Mood, tone: 'wing' as Tone  },
    green: { ring: "#4A7C59", soft: "rgba(74,124,89,0.16)",  text: "Vuelo alto",   desc: "Todo en calma",      anim: "pulse-green 4s infinite", mood: 'idle' as Mood,  tone: 'wing' as Tone  },
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

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: variant === 'sm' ? 4 : 8 }}>
      <div style={{
        position: "relative", width: S.box, height: S.box,
        display: "grid", placeItems: "center",
        borderRadius: "50%", background: palette.soft,
        animation: palette.anim,
      }}>
        <svg width={S.ring} height={S.ring} style={{ position: "absolute", inset: (S.box - S.ring) / 2, transform: "rotate(-90deg)" }}>
          <circle cx={S.ring / 2} cy={S.ring / 2} r={S.ring / 2 - 6} fill="none" stroke="rgba(26,58,82,0.08)" strokeWidth="3"/>
          <circle cx={S.ring / 2} cy={S.ring / 2} r={S.ring / 2 - 6} fill="none" stroke={palette.ring} strokeWidth="3"
                  strokeDasharray={`${dash} ${C}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .6s ease" }}/>
        </svg>
        {level === 'red' && variant !== 'sm' && (
          <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "2px solid rgba(197,51,58,0.30)", animation: "pulse-red 1.5s infinite" }}/>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <Condor size={S.condor} tone={palette.tone} mood={palette.mood} sonar={level === 'red' && variant === 'cinema'}/>
          {variant !== 'sm' && (
            <div className="tabular serif" style={{ fontSize: S.score, fontWeight: 600, lineHeight: 1, color: palette.ring, marginTop: variant === 'cinema' ? 12 : 6 }}>
              {score}<span style={{ fontSize: S.score * 0.4, color: "var(--ink-mute)", fontWeight: 400 }}>/100</span>
            </div>
          )}
          {variant === 'sm' && (
            <div className="tabular" style={{ fontSize: 11, fontWeight: 700, color: palette.ring, marginTop: 1 }}>{score}</div>
          )}
        </div>
      </div>
      {variant !== 'sm' && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: variant === 'cinema' ? 24 : 13, fontWeight: 600, color: palette.ring, letterSpacing: ".02em" }}>
            {label || palette.text}
          </div>
          <div style={{ fontSize: variant === 'cinema' ? 14 : 11, color: "var(--ink-mute)", marginTop: 2 }}>
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
        <div className="fade-up" style={{ maxWidth: 280, background: "white", border: "1px solid var(--line)", padding: "10px 14px", borderRadius: 14, boxShadow: "var(--shadow-lg)", fontSize: 12.5, color: "var(--condor-wing)", position: "relative" }}>
          <div style={{ fontSize: 10, color: "var(--andes-orange)", fontWeight: 600, marginBottom: 4, letterSpacing: ".08em" }}>EL CÓNDOR DICE</div>
          {message}
          <div style={{ position: "absolute", bottom: -6, right: 24, width: 12, height: 12, background: "white", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", transform: "rotate(45deg)" }}/>
        </div>
      )}
      <button
        onClick={onOpen}
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: mood === 'alert' ? "linear-gradient(135deg, #C5333A, #7A1F25)" : "linear-gradient(135deg, var(--mountain-blue), var(--condor-wing))",
          border: "3px solid var(--marfil-paper)", boxShadow: "var(--shadow-lg)",
          display: "grid", placeItems: "center", color: "var(--marfil)", position: "relative",
          animation: mood === 'alert' ? "pulse-red 1.2s infinite" : "none",
          cursor: "pointer",
        }}
        aria-label="Hablar con el cóndor"
      >
        <Condor size={40} tone="marfil" mood={mood}/>
        {mood === 'alert' && (
          <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "var(--guayaba-red)", border: "2px solid var(--marfil-paper)" }}/>
        )}
      </button>
    </div>
  );
}

/**
 * LearningBar REAL: lee /feedback/stats del backend.
 * Si todavia no hay feedback registrado, muestra un CTA para empezar.
 * Si hay feedback, muestra: total esta semana + acumulado + alineacion con modelo.
 * Refresca cada 30s para reflejar decisiones nuevas en otra pestaña.
 */
export function LearningBar() {
  const API = (typeof window !== "undefined" && (window as any).NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);

  function cargar() {
    fetch(`${API}/feedback/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(e => setErr(String(e?.message || e)));
  }

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30000); // refresh cada 30s
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, []);

  if (err) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px",
        background: "rgba(197,51,58,0.05)", borderBottom: "1px solid var(--line)", fontSize: 12,
      }}>
        <Condor size={16} tone="red" mood="alert"/>
        <span style={{ color: "var(--guayaba-red)" }}>No se pudo cargar el aprendizaje: {err}</span>
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const semana = stats?.ultimas_7d ?? 0;
  const align = stats?.alineacion_con_modelo_pct;
  const porDecision = stats?.por_decision || {};

  // Sin feedback aun → CTA
  if (total === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px",
        background: "linear-gradient(90deg, rgba(232,122,79,0.06), rgba(44,95,141,0.04))",
        borderBottom: "1px solid var(--line)", fontSize: 12,
      }}>
        <div style={{ position: "relative", width: 26, height: 26, display: "grid", placeItems: "center" }}>
          <Condor size={16} tone="orange" mood="think"/>
        </div>
        <div>
          <span style={{ color: "var(--condor-wing)", fontWeight: 600 }}>El cóndor está esperando aprender de vos.</span>
          <span style={{ color: "var(--ink-mute)", marginLeft: 6 }}>
            Investigá un caso y registrá tu decisión (aprobar / retener / bloquear / escalar) para alimentar el modelo.
          </span>
        </div>
      </div>
    );
  }

  // Con feedback → render real
  return (
    <div style={{
      borderBottom: "1px solid var(--line)",
      background: "linear-gradient(90deg, rgba(232,122,79,0.08), rgba(44,95,141,0.08))",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", fontSize: 12,
      }}>
        <div style={{ position: "relative", width: 26, height: 26, display: "grid", placeItems: "center" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "1.5px solid var(--andes-orange)", borderTopColor: "transparent",
            animation: "spin-slow 4s linear infinite",
          }}/>
          <Condor size={16} tone="orange" mood="idle"/>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ color: "var(--condor-wing)", fontWeight: 600 }}>
            El cóndor aprendió de <strong style={{ color: "var(--andes-orange)" }}>{semana}</strong> decisiones tuyas en los últimos 7 días
          </span>
          <span style={{ color: "var(--ink-mute)", marginLeft: 6 }}>
            ({total} acumuladas)
          </span>
          {align != null && (
            <span style={{
              color: align >= 80 ? "var(--paramo-green)" : align >= 60 ? "var(--andes-orange)" : "var(--guayaba-red)",
              fontWeight: 600, marginLeft: 8,
            }}>
              · {align}% alineación con tu nivel sugerido
            </span>
          )}
        </div>
        <button
          onClick={() => setExpandido(e => !e)}
          className="chip blue"
          style={{ cursor: "pointer", background: "transparent", border: "1px solid var(--line-strong)" }}
        >
          {expandido ? "Ocultar detalle ↑" : "Ver detalle →"}
        </button>
      </div>

      {expandido && (
        <div style={{
          padding: "10px 16px 14px",
          background: "white",
          borderTop: "1px solid var(--line)",
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10,
          fontSize: 11,
        }}>
          <MiniStat label="Total decisiones" value={total} tone="wing" />
          <MiniStat label="Esta semana" value={semana} tone="orange" />
          <MiniStat label="Alineación" value={align != null ? `${align}%` : "—"} tone={align >= 80 ? "green" : "orange"} />
          <MiniStat label="Aprobar" value={porDecision.aprobar ?? 0} tone="green" />
          <MiniStat label="Retener / Bloquear" value={(porDecision.retener ?? 0) + (porDecision.bloquear ?? 0)} tone="red" />
          <MiniStat label="Escalar" value={porDecision.escalar ?? 0} tone="orange" />

          <div style={{ gridColumn: "1 / -1", fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4 }}>
            💾 Tus decisiones se persisten en <span className="mono">data/processed/feedback_analistas.parquet</span>. El próximo reentreno del modelo XGBoost (programado mensual) incorporará todas estas etiquetas como ground truth nuevo. <strong>Cada decisión tuya hace al cóndor más preciso.</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone = "wing" }: { label: string; value: any; tone?: string }) {
  const c: any = {
    red: "var(--guayaba-red)", green: "var(--paramo-green)",
    orange: "var(--andes-orange)", wing: "var(--condor-wing)",
  };
  return (
    <div style={{ background: "var(--marfil-paper)", borderRadius: 6, padding: "6px 10px" }}>
      <div style={{ fontSize: 9, color: "var(--ink-mute)", letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</div>
      <div className="serif tabular" style={{ fontSize: 16, fontWeight: 600, color: c[tone] || c.wing, lineHeight: 1, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
