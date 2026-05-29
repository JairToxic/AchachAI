'use client';
// @ts-nocheck
/**
 * Jarvis HUD — banda visual ARRIBA de cada respuesta del cóndor.
 *
 * Recibe el texto de la respuesta (markdown) y extrae entidades automáticamente:
 *   - Casos:        SIN-XXXX, SIN-S-XXXX, SIN-H-XXXX
 *   - Proveedores:  PRV-XXXX, PRV-NEW-XXXX, PRV-MB-S-XXX, PRV-MB-H-XXX
 *   - Reglas:       RF-01..RF-07
 *   - Montos:       "USD 5,943", "$5.943", "5943 USD"
 *   - Niveles:      ROJO/AMARILLO/VERDE
 *
 * Renderiza:
 *   - Tira de KPIs (n casos, monto total, n reglas, semáforo dominante)
 *   - Chips clicables (acción: investigar / preguntar más)
 *   - Mini bar chart si hay múltiples montos
 *   - Timeline si hay fechas YYYY-MM-DD
 */
import { FaSearch, FaUserShield, FaExclamationTriangle, FaCalendarAlt, FaDollarSign } from 'react-icons/fa';

type Entities = {
  casos: string[];
  proveedores: string[];
  reglas: string[];
  montos: number[];
  fechas: string[];
  niveles: { rojo: number; amarillo: number; verde: number };
};

function extractEntities(text: string): Entities {
  const ent: Entities = {
    casos: [], proveedores: [], reglas: [], montos: [], fechas: [],
    niveles: { rojo: 0, amarillo: 0, verde: 0 },
  };
  if (!text) return ent;

  // IDs de siniestros — cubre SIN-XXXX, SIN-S-XXXX, SIN-H-XXXX
  const sinRegex = /\bSIN-[SH]?-?\d{3,7}\b/g;
  ent.casos = Array.from(new Set((text.match(sinRegex) || []).map(s => s.toUpperCase())));

  // IDs de proveedores — PRV-XXXX, PRV-NEW-XXXX, PRV-MB-S-XXX, PRV-MB-H-XXX
  const prvRegex = /\bPRV-(?:[A-Z]+-)?[A-Z0-9]+-?[A-Z0-9]*\b/g;
  ent.proveedores = Array.from(new Set((text.match(prvRegex) || []).map(s => s.toUpperCase())));

  // Reglas RF-01..RF-07
  const rfRegex = /\bRF-0?[1-7]\b/g;
  ent.reglas = Array.from(new Set((text.match(rfRegex) || []).map(s => s.toUpperCase())));

  // Montos: "USD 5,943" / "$5,943" / "5.943 USD"
  const moneyRegex = /(?:USD\s?|US\$\s?|\$)\s?([\d.,]+)|([\d.,]+)\s?USD/g;
  let m: RegExpExecArray | null;
  while ((m = moneyRegex.exec(text)) !== null) {
    const raw = m[1] || m[2];
    if (!raw) continue;
    const num = parseFloat(raw.replace(/,/g, '').replace(/\.(?=\d{3})/g, '')); // 5.943 → 5943
    if (!isNaN(num) && num >= 50 && num < 10_000_000) ent.montos.push(num);
  }

  // Fechas YYYY-MM-DD
  const dateRegex = /\b(20\d{2}-\d{2}-\d{2})\b/g;
  ent.fechas = Array.from(new Set(text.match(dateRegex) || []));

  // Conteo de niveles (palabras clave)
  const upper = text.toUpperCase();
  ent.niveles.rojo = (upper.match(/\bROJO\b/g) || []).length;
  ent.niveles.amarillo = (upper.match(/\bAMARILLO\b/g) || []).length;
  ent.niveles.verde = (upper.match(/\bVERDE\b/g) || []).length;

  return ent;
}

function dominantLevel(n: Entities['niveles']): { label: string; color: string; bg: string } | null {
  if (n.rojo === 0 && n.amarillo === 0 && n.verde === 0) return null;
  if (n.rojo >= n.amarillo && n.rojo >= n.verde && n.rojo > 0) {
    return { label: `${n.rojo} ROJO${n.rojo > 1 ? 'S' : ''}`, color: '#c5333a', bg: 'rgba(197,51,58,0.10)' };
  }
  if (n.amarillo >= n.verde && n.amarillo > 0) {
    return { label: `${n.amarillo} AMARILLO${n.amarillo > 1 ? 'S' : ''}`, color: '#d97706', bg: 'rgba(217,119,6,0.10)' };
  }
  return { label: `${n.verde} VERDE${n.verde > 1 ? 'S' : ''}`, color: '#65a30d', bg: 'rgba(101,163,13,0.10)' };
}

export function JarvisHUD({
  text,
  onInvestigateCase,
  onAskMore,
}: {
  text: string;
  onInvestigateCase?: (id: string) => void;
  onAskMore?: (query: string) => void;
}) {
  const ent = extractEntities(text);
  const hasAny =
    ent.casos.length || ent.proveedores.length || ent.reglas.length ||
    ent.montos.length > 1 || ent.fechas.length || dominantLevel(ent.niveles);

  if (!hasAny) return null;

  const level = dominantLevel(ent.niveles);
  const montoTotal = ent.montos.reduce((a, b) => a + b, 0);
  const montoMax = Math.max(...ent.montos, 0);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#f4ede4',
        padding: '12px 14px',
        borderRadius: 10,
        marginBottom: 10,
        fontSize: 11.5,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 4px 14px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.08)',
        border: '1px solid rgba(231,111,81,0.25)',
      }}
    >
      {/* Header HUD */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
        color: '#e76f51', fontWeight: 700,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#e76f51',
          boxShadow: '0 0 8px #e76f51', animation: 'pulse-hud 1.8s ease-in-out infinite',
        }} />
        Evidencia detectada en la respuesta
      </div>

      {/* KPIs en fila */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 8, marginBottom: ent.casos.length || ent.proveedores.length || ent.reglas.length ? 10 : 0,
      }}>
        {ent.casos.length > 0 && (
          <Kpi icon={FaSearch} label="Casos" value={ent.casos.length} color="#ffb38a" />
        )}
        {ent.proveedores.length > 0 && (
          <Kpi icon={FaUserShield} label="Proveedores" value={ent.proveedores.length} color="#ffe0b3" />
        )}
        {ent.reglas.length > 0 && (
          <Kpi icon={FaExclamationTriangle} label="Reglas RF" value={ent.reglas.length} color="#ff8b6a" />
        )}
        {montoMax > 0 && (
          <Kpi icon={FaDollarSign} label="Monto pico" value={`$${(montoMax/1000).toFixed(1)}K`} color="#aae3a0" />
        )}
        {level && (
          <div style={{
            padding: '8px 10px', borderRadius: 6,
            background: level.bg, border: `1px solid ${level.color}40`,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <div style={{ fontSize: 8.5, opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Semáforo</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: level.color }}>{level.label}</div>
          </div>
        )}
      </div>

      {/* Chips de casos */}
      {ent.casos.length > 0 && (
        <ChipRow
          label="Siniestros mencionados"
          items={ent.casos}
          color="#ffb38a"
          onClick={onInvestigateCase}
          actionLabel="investigar"
        />
      )}

      {/* Chips de proveedores */}
      {ent.proveedores.length > 0 && (
        <ChipRow
          label="Proveedores mencionados"
          items={ent.proveedores}
          color="#ffe0b3"
          onClick={(p) => onAskMore && onAskMore(`Dame el historial completo del proveedor ${p}`)}
          actionLabel="ver historial"
        />
      )}

      {/* Chips de reglas */}
      {ent.reglas.length > 0 && (
        <ChipRow
          label="Reglas críticas activadas"
          items={ent.reglas}
          color="#ff8b6a"
          onClick={(r) => onAskMore && onAskMore(`Explicame qué es la regla ${r} del manual antifraude`)}
          actionLabel="qué es"
        />
      )}

      {/* Mini bar chart de montos (si hay ≥2) */}
      {ent.montos.length >= 2 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9.5, opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Montos detectados ({ent.montos.length})
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 36 }}>
            {ent.montos.slice(0, 12).map((m, i) => {
              const h = montoMax > 0 ? (m / montoMax) * 100 : 0;
              return (
                <div
                  key={i}
                  title={`$${m.toLocaleString('en-US')}`}
                  style={{
                    flex: 1, height: `${Math.max(8, h)}%`,
                    background: `linear-gradient(180deg, #e76f51, #c5333a)`,
                    borderRadius: '2px 2px 0 0',
                    minHeight: 4,
                  }}
                />
              );
            })}
          </div>
          <div style={{ fontSize: 9.5, opacity: 0.55, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>min ${Math.min(...ent.montos).toLocaleString('en-US')}</span>
            <span>total ${montoTotal.toLocaleString('en-US')}</span>
            <span>max ${montoMax.toLocaleString('en-US')}</span>
          </div>
        </div>
      )}

      {/* Timeline si hay fechas */}
      {ent.fechas.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9.5, opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            <FaCalendarAlt size={9} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Línea de tiempo
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ent.fechas.sort().map((f, i) => (
              <span key={i} style={{
                padding: '3px 8px', fontSize: 11, borderRadius: 4,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse-hud {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: any) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 6,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 8.5, opacity: 0.65, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon size={9} />{label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function ChipRow({
  label, items, color, onClick, actionLabel,
}: {
  label: string;
  items: string[];
  color: string;
  onClick?: (item: string) => void;
  actionLabel?: string;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 9.5, opacity: 0.7,
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5,
      }}>
        {label} ({items.length})
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {items.slice(0, 12).map(it => (
          <button
            key={it}
            onClick={() => onClick && onClick(it)}
            title={actionLabel ? `${it} — ${actionLabel}` : it}
            disabled={!onClick}
            style={{
              padding: '4px 9px', borderRadius: 4, fontSize: 10.5,
              background: `${color}18`,
              border: `1px solid ${color}40`,
              color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
              cursor: onClick ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!onClick) return;
              (e.currentTarget as HTMLElement).style.background = `${color}30`;
            }}
            onMouseLeave={(e) => {
              if (!onClick) return;
              (e.currentTarget as HTMLElement).style.background = `${color}18`;
            }}
          >
            {it}
          </button>
        ))}
      </div>
    </div>
  );
}
