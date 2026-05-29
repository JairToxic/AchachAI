'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Condor, VueloDelCondor } from './Condor';
import { CondorSilhouette } from './CondorSilhouette';
import { CondorLogo } from './CondorLogo';
import { EcuadorHeatMap } from './EcuadorHeatMap';
import {
  FaBroadcastTower,
  FaSearch,
  FaNetworkWired,
  FaMapMarkedAlt,
  FaUsers,
  FaFileAlt,
  FaDollarSign,
  FaChartBar,
  FaChartLine,
  FaClipboardCheck,
  FaBolt,
  FaCheckCircle,
  FaFileInvoice,
  FaUserShield,
  FaBriefcase,
  FaDownload,
  FaBrain,
  FaPaperPlane,
  FaMicrophone,
  FaExclamationTriangle,
  FaCoins,
  FaCog,
  FaLightbulb,
  FaEye,
  FaThumbsUp,
  FaThumbsDown,
  FaBuilding,
  FaUserCircle,
  FaPlane,
  FaPlay,
} from 'react-icons/fa';

/* Estilos para markdown del condor: tablas + listas con look del design system */
const MD_STYLES: React.CSSProperties = {
  fontSize: 13.5, lineHeight: 1.55, color: 'var(--condor-wing)',
};

const mdComponents = {
  table: ({ children }: any) => (
    <div style={{ overflow: 'auto', margin: '8px 0', borderRadius: 8, border: '1px solid var(--line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead style={{ background: 'var(--marfil-paper)' }}>{children}</thead>,
  th: ({ children }: any) => (
    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{children}</th>
  ),
  td: ({ children }: any) => (
    <td style={{ padding: '8px 10px', verticalAlign: 'middle', borderBottom: '1px solid var(--line)' }}>{children}</td>
  ),
  tr: ({ children }: any) => <tr>{children}</tr>,
  ul: ({ children }: any) => <ul style={{ margin: '6px 0 6px 18px', padding: 0 }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ margin: '6px 0 6px 18px', padding: 0 }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ margin: '3px 0' }}>{children}</li>,
  p: ({ children }: any) => <p style={{ margin: '6px 0' }}>{children}</p>,
  strong: ({ children }: any) => <strong style={{ color: 'var(--condor-wing)', fontWeight: 600 }}>{children}</strong>,
  code: ({ children }: any) => (
    <code style={{ background: 'rgba(26,58,82,0.06)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11.5 }}>{children}</code>
  ),
  h1: ({ children }: any) => <h3 style={{ fontSize: 16, margin: '10px 0 6px', fontWeight: 600 }}>{children}</h3>,
  h2: ({ children }: any) => <h3 style={{ fontSize: 15, margin: '10px 0 6px', fontWeight: 600 }}>{children}</h3>,
  h3: ({ children }: any) => <h4 style={{ fontSize: 14, margin: '8px 0 4px', fontWeight: 600 }}>{children}</h4>,
};

export function MD({ children }: { children: string }) {
  return (
    <div style={MD_STYLES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}

/* ============================================================
   Catálogo humano de tools — qué dice cada una mientras corre
   ============================================================ */
export const TOOL_NARRATIVE: Record<string, { phrase: string; icon: any; tone: string; detail: string }> = {
  top_riesgo:                { phrase: "Escaneando casos críticos",       icon: FaBroadcastTower, tone: "var(--danger)",  detail: "Aplicando scoring híbrido (reglas + XGBoost) a 39.960 siniestros multi-ramo…" },
  detalle_siniestro:         { phrase: "Recuperando detalle del caso",    icon: FaSearch,         tone: "var(--primary)", detail: "Cruzando póliza + asegurado + vehículo + proveedor + documentos…" },
  ranking_proveedores:       { phrase: "Calculando concentración por proveedor", icon: FaNetworkWired, tone: "var(--accent)", detail: "Agregando casos por proveedor en últimos 90 días…" },
  ranking_ciudades:          { phrase: "Mapeando geografía del fraude",   icon: FaMapMarkedAlt,   tone: "var(--accent)",  detail: "Agrupando casos por ciudad y calculando densidad…" },
  asegurados_recurrentes:    { phrase: "Detectando clientes frecuentes",  icon: FaUsers,          tone: "var(--warning)", detail: "Buscando asegurados con múltiples reclamos en 18 meses…" },
  docs_faltantes:            { phrase: "Auditando completitud documental", icon: FaFileAlt,       tone: "var(--warning)", detail: "Listando casos con documentos faltantes o ilegibles…" },
  montos_atipicos:           { phrase: "Identificando montos anómalos",   icon: FaDollarSign,     tone: "var(--danger)",  detail: "Filtrando reclamos cercanos al 95% de suma asegurada…" },
  estadisticas_por_cobertura:{ phrase: "Analizando por tipo de cobertura", icon: FaChartBar,      tone: "var(--primary)", detail: "Calculando % fraude por ramo y monto promedio…" },
  simulacion_ahorro:         { phrase: "Calculando ROI y proyección",     icon: FaChartLine,      tone: "var(--success)", detail: "Estimando ahorro anual con tasa de detección AchachAI…" },
  exportar_reporte:          { phrase: "Preparando reporte de auditoría", icon: FaClipboardCheck, tone: "var(--text-primary)", detail: "Generando CSV con casos del nivel solicitado…" },
};

const PHRASES_PHASE = [
  { p: "Conectando con Azure ML…",       d: 200 },
  { p: "Resolviendo intención…",         d: 300 },
  { p: "Decidiendo qué herramientas usar", d: 250 },
];

/* ============================================================
   JarvisStream — visualización en tiempo real estilo Iron Man HUD
   ============================================================ */
function RadarSweep({ size = 64, tone = "#E87A4F" }: { size?: number; tone?: string }) {
  return (
    <div style={{
      position: "relative", width: size, height: size,
      borderRadius: "50%", background: "radial-gradient(circle, rgba(232,122,79,0.15) 0%, rgba(232,122,79,0.02) 70%, transparent 100%)",
      border: `1.5px solid ${tone}40`, overflow: "hidden",
    }}>
      {/* anillos concéntricos */}
      {[0.3, 0.55, 0.8].map((r, i) => (
        <div key={i} style={{
          position: "absolute", inset: `${(1-r)*50}%`,
          borderRadius: "50%", border: `1px solid ${tone}30`,
        }}/>
      ))}
      {/* línea cruzada */}
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: `${tone}30` }}/>
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: `${tone}30` }}/>
      {/* sweep arm */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", width: size/2, height: 2,
        background: `linear-gradient(90deg, ${tone}, transparent)`,
        transformOrigin: "0 50%",
        animation: "spin-slow 2s linear infinite",
      }}/>
      {/* centro */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 8, height: 8, borderRadius: "50%", background: tone,
        boxShadow: `0 0 12px ${tone}80`,
        animation: "pulse-red 1s infinite",
      }}/>
      {/* puntos detectados (random pings) */}
      <div style={{ position: "absolute", top: "20%", left: "30%", width: 4, height: 4, borderRadius: "50%", background: tone, animation: "pulse-red 1.5s infinite" }}/>
      <div style={{ position: "absolute", top: "70%", left: "65%", width: 4, height: 4, borderRadius: "50%", background: tone, animation: "pulse-red 1.5s infinite 0.5s" }}/>
      <div style={{ position: "absolute", top: "35%", left: "75%", width: 4, height: 4, borderRadius: "50%", background: tone, animation: "pulse-red 1.5s infinite 1s" }}/>
    </div>
  );
}

export function JarvisStream({ phase, tools, currentTool }: { phase: string; tools: string[]; currentTool?: string }) {
  const total = 10; // total approximate tools available
  const doneCount = tools.length - (currentTool ? 1 : 0);
  const progress = Math.min(95, tools.length * 18 + (currentTool ? 12 : 0));

  return (
    <div className="fade-up" style={{ display: "flex", gap: 14, marginBottom: 20 }}>
      <RadarSweep size={56} tone="#E87A4F" />
      <div style={{ flex: 1, maxWidth: 800 }}>
        <div style={{
          background: "linear-gradient(180deg, #0F2436, #1A3A52)",
          color: "var(--marfil)",
          borderRadius: "4px 16px 16px 16px",
          padding: "14px 18px 16px",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid rgba(232,122,79,0.3)",
          position: "relative", overflow: "hidden",
        }}>
          {/* scan line decorativa */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(180deg, transparent, rgba(232,122,79,0.06), transparent)",
            backgroundSize: "100% 200%",
            animation: "scan-beam 3s linear infinite",
          }}/>

          {/* cóndor planeando sobre el HUD mientras piensa */}
          <div style={{
            position: "absolute", top: 4, left: 0, right: 0, height: 40,
            pointerEvents: "none", overflow: "hidden", zIndex: 0,
          }}>
            <div style={{
              position: "absolute", top: 4,
              animation: "condor-glide 7s linear infinite",
              filter: "drop-shadow(0 0 8px rgba(232,122,79,0.55))",
            }}>
              <CondorSilhouette width={60} color="var(--andes-orange)" style={{ opacity: 0.75 }}/>
            </div>
          </div>

          {/* segundo cóndor más pequeño, en sentido contrario */}
          <div style={{
            position: "absolute", bottom: 40, left: 0, right: 0, height: 28,
            pointerEvents: "none", overflow: "hidden", zIndex: 0,
          }}>
            <div style={{
              position: "absolute", top: 0,
              animation: "condor-glide-fast 9s linear infinite 1.5s",
              filter: "drop-shadow(0 0 6px rgba(232,122,79,0.4))",
            }}>
              <CondorSilhouette width={36} color="var(--pink-dawn)" flip style={{ opacity: 0.5 }}/>
            </div>
          </div>

          {/* Header HUD */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, position: "relative" }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".18em", color: "var(--andes-orange)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--andes-orange)", boxShadow: "0 0 8px var(--andes-orange)", animation: "pulse-red 0.8s infinite" }}/>
              TRANSMISIÓN EN VIVO
            </div>
            <span style={{ flex: 1 }}/>
            <span className="mono" style={{ fontSize: 9.5, color: "rgba(244,237,228,0.5)", letterSpacing: ".1em" }}>
              GPT-5-MINI · AZURE FOUNDRY · {tools.length}/{total} TOOLS
            </span>
          </div>

          {/* fase actual con typewriter feel */}
          <div style={{
            fontSize: 14, color: "var(--marfil)", marginBottom: 12,
            fontWeight: 500, fontFamily: "var(--serif)", letterSpacing: ".005em",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>{phase || "Procesando…"}</span>
            <span style={{ display: "inline-block", width: 8, height: 14, background: "var(--andes-orange)", animation: "typewriter-blink 0.9s infinite" }}/>
          </div>

          {/* progress bar global */}
          <div style={{ height: 3, background: "rgba(244,237,228,0.1)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: "linear-gradient(90deg, var(--andes-orange), var(--pink-dawn), var(--andes-orange))",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s linear infinite",
              transition: "width .3s",
            }}/>
          </div>

          {/* Timeline de tools ejecutados */}
          {tools.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tools.map((t, i) => {
                const nar = TOOL_NARRATIVE[t] || { phrase: t, icon: FaBolt, tone: "var(--warning)", detail: "Procesando…" };
                const isCurrent = i === tools.length - 1 && t === currentTool;
                const isDone = !isCurrent;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "9px 11px", borderRadius: 8,
                    background: isCurrent ? "rgba(232,122,79,0.18)" : "rgba(244,237,228,0.05)",
                    border: `1px solid ${isCurrent ? "rgba(232,122,79,0.5)" : "rgba(244,237,228,0.08)"}`,
                    animation: isCurrent ? "fade-up .25s ease both" : "none",
                  }}>
                    <span style={{ color: nar.tone, marginTop: 1, display: 'grid', placeItems: 'center' }}>
                      {typeof nar.icon === 'function' ? <nar.icon size={14} /> : null}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--marfil)" }}>{nar.phrase}</span>
                        <span className="mono" style={{ fontSize: 9.5, color: "rgba(244,237,228,0.55)", letterSpacing: ".06em" }}>[{t}]</span>
                        <span style={{ flex: 1 }}/>
                        {isDone && (
                          <span className="mono" style={{ fontSize: 10, color: "var(--success)", fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FaCheckCircle size={9} /> {(180 + i * 50 + Math.floor(Math.random() * 80)).toString()}ms
                          </span>
                        )}
                        {isCurrent && (
                          <span className="mono" style={{ fontSize: 10, color: "var(--andes-orange)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--andes-orange)", animation: "pulse-red 0.6s infinite" }}/>
                            EJECUTANDO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(244,237,228,0.7)", marginTop: 2, lineHeight: 1.4 }}>{nar.detail}</div>
                      {isCurrent && (
                        <div style={{ marginTop: 6, height: 2, background: "rgba(244,237,228,0.08)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: "60%",
                            background: "linear-gradient(90deg, transparent, var(--andes-orange), transparent)",
                            backgroundSize: "200% 100%",
                            animation: "shimmer 1.1s linear infinite",
                          }}/>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tools.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", color: "var(--andes-orange)" }}>
              <span style={{ display: "inline-flex", gap: 4 }}>
                {[0, 0.15, 0.3, 0.45].map(d => (
                  <span key={d} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: "var(--andes-orange)",
                    animation: `pulse-red 0.8s infinite ${d}s`,
                    boxShadow: "0 0 6px var(--andes-orange)",
                  }}/>
                ))}
              </span>
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "rgba(244,237,228,0.8)" }}>
                EL CÓNDOR ESTÁ DECIDIENDO QUÉ TOOLS USAR…
              </span>
            </div>
          )}

          {/* Footer mini stats */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(244,237,228,0.12)",
            fontSize: 9.5, color: "rgba(244,237,228,0.5)", letterSpacing: ".06em",
          }}>
            <span className="mono">CARTERA · 39.960 SINIESTROS · 271 PROVEEDORES · 3 RAMOS</span>
            <span className="mono">LATENCIA: {(Math.random() * 600 + 200).toFixed(0)}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Smart annotators: detectan IDs / scores / niveles en el texto
   y los convierten en componentes visuales (badges + Vuelo del Cóndor)
   ============================================================ */
const ID_REGEX = /(SIN-\d{4,7})/g;
const PROV_REGEX = /(PRV-(?:NEW)?\d{3,5})/g;
const NIVEL_REGEX = /\b(ROJO|AMARILLO|VERDE)\b/g;
const SCORE_PAIR_REGEX = /\b(\d{1,3})\s*\/\s*100\b/g;

type CaseEv = { id: string; score: number | null; nivel: string | null };

/**
 * Parsea cada linea/fila de tabla markdown que contenga un SIN-ID
 * y devuelve {id, score, nivel} por caso.
 *
 *   "| SIN-108538 | VERDE | 36 | Choque | ..."
 *      -> { id: SIN-108538, nivel: VERDE, score: 36 }
 */
function extractCasesFromText(text: string): CaseEv[] {
  const out: CaseEv[] = [];
  const seen = new Set<string>();
  // Separamos por lineas (incluye filas de tabla markdown porque cada fila esta en su linea)
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const ids = rawLine.match(ID_REGEX);
    if (!ids) continue;
    // Si la linea tiene mas de un SIN-id, usamos el primero como ancla
    // (las filas de tabla normales solo tienen 1, las listas inline tambien)
    const id = ids[0];
    if (seen.has(id)) continue;
    seen.add(id);

    // Buscamos nivel y score SOLO en esta linea, no en todo el texto
    const nivelMatch = rawLine.match(NIVEL_REGEX);
    const nivel = nivelMatch ? nivelMatch[0] : null;

    // 1) Si la linea explicita "NN/100", usalo
    const pair = rawLine.match(SCORE_PAIR_REGEX);
    let score: number | null = null;
    if (pair && pair.length > 0) {
      score = parseInt(pair[0]);
    } else {
      // 2) Score sin "/100": buscar numero 0..100 que no sea parte de un monto
      //    ni de un anio (4 digitos). Tomamos el PRIMER int 0..100 despues del id
      //    e ignoramos cifras con $ o "USD" cerca, y digitos pegados a otros digitos.
      const after = rawLine.slice(rawLine.indexOf(id) + id.length);
      const tokens = after.match(/(?<![\d$])(\d{1,3})(?!\d)/g) || [];
      for (const t of tokens) {
        const n = parseInt(t);
        if (n >= 0 && n <= 100) { score = n; break; }
      }
    }
    out.push({ id, score, nivel });
  }
  return out;
}

function extractEvidence(text: string): { cases: CaseEv[]; provs: string[]; niveles: string[] } {
  const cases = extractCasesFromText(text);
  const provs = Array.from(new Set((text.match(PROV_REGEX) || [])));
  // Niveles SOLO de los casos detectados, no del texto suelto
  // (evita que la palabra "AMARILLO/ROJO" en un comentario meta inyecte chips)
  const nivelesDeCasos = Array.from(new Set(cases.map(c => c.nivel).filter(Boolean) as string[]));
  return { cases, provs, niveles: nivelesDeCasos };
}

/* Score visual cuando no pudimos parsear uno real */
function scoreVisualPorNivel(nivel: string | null): number {
  if (nivel === 'ROJO') return 82;
  if (nivel === 'AMARILLO') return 52;
  if (nivel === 'VERDE') return 22;
  return 50;
}

/**
 * Cuando el agente llama ranking_ciudades, fetchea el ranking y muestra
 * el mapa de calor de Ecuador con tooltips y leyenda.
 */
export function CityHeatmapAuto() {
  const API = (typeof window !== "undefined" && (window as any).NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const [data, setData] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/ciudades/ranking?top_n=15`)
      .then(r => r.json())
      .then(d => setData(d.top || []))
      .catch(e => setErr(String(e?.message || e)));
  }, []);

  if (err) return (
    <div style={{ padding: "10px 18px", fontSize: 11, color: "var(--guayaba-red)" }}>
      No pude cargar el mapa de Ecuador: {err}
    </div>
  );
  if (!data) return (
    <div style={{ padding: "10px 18px", fontSize: 11, color: "var(--ink-mute)" }}>
      <FaMapMarkedAlt size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Dibujando mapa de calor de Ecuador…
    </div>
  );
  if (data.length === 0) return null;

  return (
    <div style={{ padding: "10px 18px 14px" }}>
      <EcuadorHeatMap
        data={data}
        metric="tasa"
        title="Mapa de calor · Ecuador (tasa de alertas históricas por ciudad)"
      />
    </div>
  );
}

/**
 * Card flotante con botón de descarga cuando el agente generó un reporte PDF.
 */
export function ReportePdfCard({ r }: { r: any }) {
  const API = (typeof window !== "undefined" && (window as any).NEXT_PUBLIC_API_URL) || "http://localhost:8000";
  const fullUrl = r.url_descarga?.startsWith("http") ? r.url_descarga : `${API}${r.url_descarga}`;
  const toneByTipo: Record<string, string> = {
    ejecutivo: "var(--andes-orange)",
    antifraude: "var(--guayaba-red)",
    auditoria: "var(--paramo-green)",
    directorio: "var(--mountain-blue)",
  };
  const iconByTipo: Record<string, any> = {
    ejecutivo: FaClipboardCheck, antifraude: FaUserShield, auditoria: FaFileInvoice, directorio: FaBriefcase,
  };
  const tone = toneByTipo[r.tipo] || "var(--andes-orange)";

  return (
    <div style={{
      padding: "14px 18px 16px",
      background: "linear-gradient(180deg, var(--marfil-paper), white)",
      borderTop: "1px solid var(--line)",
    }}>
      <div style={{
        padding: 14, borderRadius: 10,
        background: "white",
        border: `1.5px solid ${tone}40`, borderLeft: `4px solid ${tone}`,
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 10,
          background: `${tone}1A`, color: tone, display: "grid", placeItems: "center",
        }}>
          {(() => { const I = iconByTipo[r.tipo] || FaFileAlt; return <I size={24} />; })()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: tone, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FaFileAlt size={11} /> Reporte PDF generado
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--condor-wing)", marginTop: 2 }}>
            {r.titulo}
            <span className="chip mono" style={{ fontSize: 9, marginLeft: 6, background: `${tone}15`, color: tone }}>
              {r.nivel_casos}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
            Audiencia: {r.audiencia} · click para abrir e imprimir como PDF
          </div>
        </div>
        <a
          href={fullUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "10px 18px", borderRadius: 8, textDecoration: "none",
            background: `linear-gradient(135deg, ${tone}, ${tone}dd)`,
            color: "white", fontWeight: 600, fontSize: 13,
            boxShadow: `0 4px 12px ${tone}40`,
            whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <FaDownload size={12} /> Descargar PDF
        </a>
      </div>
    </div>
  );
}

/**
 * Card visual con resultado de evaluar_caso_hipotetico desde el chat.
 */
export function EvaluacionCard({ e, onInvestigate }: { e: any; onInvestigate?: (id: string) => void }) {
  const nivel = e.nivel || "VERDE";
  const tone = nivel === "ROJO" ? "var(--guayaba-red)"
            : nivel === "AMARILLO" ? "var(--andes-orange)"
            : "var(--paramo-green)";
  const reglas = e.reglas_criticas_activadas || [];
  const senales = e.senales_activadas || [];

  return (
    <div style={{
      padding: "14px 18px 16px",
      background: "linear-gradient(180deg, var(--marfil-paper), white)",
      borderTop: "1px solid var(--line)",
    }}>
      <div style={{
        padding: 16, borderRadius: 10,
        background: "white", border: `1.5px solid ${tone}40`,
        borderTop: `3px solid ${tone}`,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr auto", gap: 14, alignItems: "center" }}>
          {/* Score gauge mini */}
          <svg viewBox="0 0 100 100" style={{ width: 90, height: 90 }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="42" fill="none" stroke={tone} strokeWidth="6"
              strokeDasharray={`${(e.score/100) * 263.9} 263.9`}
              strokeDashoffset="65.97"
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
            <text x="50" y="52" textAnchor="middle" fontSize="24" fontWeight="600" fill={tone} fontFamily="var(--serif)">
              {e.score}
            </text>
            <text x="50" y="68" textAnchor="middle" fontSize="8" fill="var(--ink-mute)">/100</text>
          </svg>

          <div>
            <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: tone, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FaBolt size={11} /> Evaluación en vivo
            </div>
            <div style={{ fontSize: 18, fontFamily: "var(--serif)", fontWeight: 600, color: tone, marginTop: 2 }}>
              {nivel}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.45 }}>
              {e.input_resumido}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 4 }}>
              {reglas.length} regla(s) crítica(s) · {senales.length} señal(es) · {e.puntos_totales_senales || 0} pts señales
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            {reglas.slice(0, 3).map((r: any) => (
              <span key={r.codigo} className="chip red mono" style={{ fontSize: 9 }}>{r.codigo}</span>
            ))}
            {senales.slice(0, 3).map((s: any) => (
              <span key={s.id} className="chip amber mono" style={{ fontSize: 9 }}>S{s.id} +{s.puntos}</span>
            ))}
          </div>
        </div>

        {e.accion_sugerida && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: `${tone}12`, borderLeft: `3px solid ${tone}`, borderRadius: 6,
            fontSize: 12, color: "var(--ink-soft)",
          }}>
            <strong style={{ color: tone }}>Acción sugerida:</strong> {e.accion_sugerida}
          </div>
        )}
      </div>
    </div>
  );
}

export function EvidencePreview({ summary, onInvestigate }: { summary: string; onInvestigate?: (id: string) => void }) {
  const ev = extractEvidence(summary);
  if (ev.cases.length === 0 && ev.provs.length === 0) return null;

  const cards = ev.cases.slice(0, 6).map(c => ({
    id: c.id,
    score: c.score != null ? c.score : scoreVisualPorNivel(c.nivel),
    nivel: c.nivel,
    scoreReal: c.score != null,
  }));

  return (
    <div style={{
      padding: "16px 18px 18px",
      background: "linear-gradient(180deg, var(--marfil-paper), var(--marfil))",
      borderTop: "1px solid var(--line)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <CondorLogo size={22} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--condor-wing)" }}>
            Evidencia visual auto-detectada
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".06em" }}>
            {cards.length} caso(s) · {ev.provs.length} proveedor(es) · {ev.niveles.length} nivel(es)
          </div>
        </div>
        <span style={{ flex: 1 }}/>
        <span className="chip outline" style={{ fontSize: 9.5, background: "white" }}>click → investigar</span>
      </div>

      {cards.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: ev.provs.length > 0 ? 14 : 0 }}>
          {cards.map(c => {
            // El nivel manda. Si no hay nivel, caemos al score.
            const level = c.nivel
              ? (c.nivel === 'ROJO' ? 'red' : c.nivel === 'AMARILLO' ? 'amber' : 'green')
              : (c.score >= 70 ? 'red' : c.score >= 40 ? 'amber' : 'green');
            const accent = level === "red" ? "var(--guayaba-red)" : level === "amber" ? "var(--andes-ocher)" : "var(--paramo-green)";
            return (
              <button key={c.id}
                onClick={() => onInvestigate && onInvestigate(c.id)}
                style={{
                  cursor: "pointer", background: "white",
                  border: `1px solid ${accent}40`,
                  borderTop: `3px solid ${accent}`,
                  borderRadius: 12, padding: "12px 14px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  transition: "transform .15s, box-shadow .15s, border-color .15s",
                  minWidth: 130,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <VueloDelCondor score={c.score} variant="sm" />
                <span className="mono" style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: ".04em" }}>{c.id}</span>
                {c.nivel && (
                  <span className={`chip ${level}`} style={{ fontSize: 9, padding: '1px 6px' }}>
                    {c.nivel}{!c.scoreReal && ' · score~'}
                  </span>
                )}
                <span style={{ fontSize: 10, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                  <FaSearch size={9} /> Investigar
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Proveedores y niveles mencionados */}
      {(ev.provs.length > 0 || ev.niveles.length > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", paddingTop: cards.length > 0 ? 10 : 0, borderTop: cards.length > 0 ? "1px dashed var(--line)" : "none" }}>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase" }}>menciones detectadas:</span>
          {ev.provs.slice(0, 6).map(p => (
            <span key={p} className="chip" style={{
              fontSize: 10.5, padding: "3px 9px",
              background: "rgba(44,95,141,0.10)",
              color: "var(--mountain-blue)",
              border: "1px solid rgba(44,95,141,0.2)",
              fontWeight: 500,
            }}><FaBuilding size={10} /> {p}</span>
          ))}
          {ev.niveles.map(n => {
            const cls = n === "ROJO" ? "red" : n === "AMARILLO" ? "amber" : "green";
            const label = n === "ROJO" ? "Riesgo alto" : n === "AMARILLO" ? "Riesgo medio" : "Riesgo bajo";
            const dotColor = n === "ROJO" ? "var(--danger)" : n === "AMARILLO" ? "var(--warning)" : "var(--success)";
            return (
              <span key={n} className={`chip ${cls}`} style={{ fontSize: 10.5, padding: "3px 9px", fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, display: 'inline-block', marginRight: 6 }} /> {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

const useStateChat = useState;
const useEffectChat = useEffect;
const useRefChat = useRef;

/* ============================================================
   CÓNDOR AGÉNTICO — chat screen (CU-05 · the protagonist)
   ============================================================ */

export const ROLE_PROMPTS = {
  antifraude: [
    "Mostrame los 10 casos más críticos de hoy",
    "¿Qué patrones se repiten en los rojos de esta semana?",
    "Investigar SIN-100029 con todos los documentos",
  ],
  siniestros: [
    "¿Cuáles 5 casos debería resolver hoy?",
    "Resumime el avance de mi cola",
    "Marcar SIN-100456 como no fraude — justificar",
  ],
  jefatura: [
    "¿Qué sucursal tiene más casos pendientes?",
    "Productividad de mi equipo este mes",
    "Reasignar carga de María al equipo de Quito",
  ],
  riesgos: [
    "¿Qué proveedor concentra más exposición?",
    "Simular qué pasa si bloqueamos a los top 5 sospechosos",
    "Tendencia de exposición por segmento Premium",
  ],
  auditoria: [
    "Lista los casos cerrados con RF-03 en marzo",
    "¿Qué casos cambió María en la última semana?",
    "Generar reporte regulatorio SBS Q1",
  ],
  tecnologia: [
    "¿Hay algún endpoint con latencia alta?",
    "Comparar performance v3 vs v4 del modelo",
    "Revisar logs de errores de las últimas 24h",
  ],
  gerencia: [
    "¿Cuánto recuperamos este mes vs el anterior?",
    "Simular qué pasa si la tasa de detección sube a 80%",
    "Top 3 logros para el board meeting de mañana",
  ],
};

export const TOOLS_CATALOG = [
  "top_riesgo", "detalle_siniestro", "ranking_proveedores",
  "ranking_ciudades", "asegurados_recurrentes", "docs_faltantes",
  "montos_atipicos", "estadisticas_por_cobertura",
  "simulacion_ahorro", "exportar_reporte",
];

/* canned answer for the demo */
export const CANNED_ANSWERS = {
  proveedor: {
    summary: "Encontré 8 proveedores con concentración alta. PRV-NEW0019 destaca con $156K en reclamos del último mes.",
    tools: ["ranking_proveedores", "montos_atipicos", "estadisticas_por_cobertura"],
    sources: [
      "Consulté la tabla 'proveedores' (198 registros)",
      "Filtré por casos > 30 en últimos 90 días",
      "Crucé con 'siniestros' por id_proveedor",
      "Apliqué umbral P90 dinámico",
      "Ranking final con etiqueta_fraude_simulada",
    ],
    tableHeaders: ["Proveedor", "Casos 90d", "Exposición", "Score"],
    tableRows: [
      ["PRV-NEW0019 · Auto Servicio Andes", "32", "$156.000", 87],
      ["PRV-0007 · Taller Cumbayá", "28", "$132.400", 78],
      ["PRV-0042 · Clínica San Rafael", "21", "$98.200", 71],
      ["PRV-0019 · Multipartes Guayas", "18", "$76.500", 64],
      ["PRV-0103 · Repuestos del Valle", "14", "$54.300", 58],
    ],
    chart: true,
    cost: { tokens: 847, time: "1.4s", price: "$0.001" },
  },
  default: {
    summary: "Revisé tu cartera. Hoy hay 12 casos en rojo, 47 en observación. El proveedor PRV-NEW0019 explica el 38% de la exposición crítica.",
    tools: ["top_riesgo", "ranking_proveedores"],
    sources: [
      "Consulté tabla 'siniestros' (39.960 registros multi-ramo)",
      "Apliqué scoring XGBoost v4 (Azure ML)",
      "Filtré por score ≥ 70",
    ],
    cost: { tokens: 612, time: "0.9s", price: "$0.0007" },
  },
};

export function ChatScreen({ role = "antifraude", onInvestigate }) {
  const [messages, setMessages] = useStateChat([
    {
      role: "condor",
      kind: "greeting",
      text: "Hola María. Sobrevolé tu cartera mientras dormías. Hay 12 casos en rojo nuevos y un proveedor que me llama la atención.",
      time: "08:14",
    },
    {
      role: "condor",
      kind: "proactive",
      text: "Mientras revisabas el café, llegaron 3 casos críticos del proveedor PRV-NEW0019. ¿Querés que te los muestre?",
      time: "08:42",
      actions: ["Ver los 3 casos", "Más tarde"],
    },
  ]);
  const [input, setInput] = useStateChat("");
  const [thinking, setThinking] = useStateChat(false);
  const [activeTools, setActiveTools] = useStateChat([]);
  const [currentPhase, setCurrentPhase] = useStateChat("Conectando con Azure ML…");
  const [currentTool, setCurrentTool] = useStateChat(null);
  const scrollerRef = useRefChat<any>(null);
  const promptIdx = useRefChat(0);

  useEffectChat(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, thinking, activeTools]);

  function send(text) {
    const q = (text || input).trim();
    if (!q) return;
    setMessages(m => [...m, { role: "user", text: q, time: now() }]);
    setInput("");
    runAgent(q);
  }

  async function runAgent(q) {
    const API = (window.NEXT_PUBLIC_API_URL || "http://localhost:8000");
    setThinking(true);
    setActiveTools([]);
    setCurrentTool(null);

    setCurrentPhase("Despegando · conectando con Azure AI Foundry…");

    // ID temporal para el mensaje que vamos a ir actualizando con los deltas
    const streamingId = `stream-${Date.now()}`;
    const toolsCalled: string[] = [];
    const toolsFull: any[] = [];
    let accumulatedText = "";
    let totalTokens = 0;
    let iterations = 1;
    let firstDelta = true;

    try {
      const resp = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          history: messages.filter(m => m.text).slice(-6).map(m => ({
            role: m.role === "condor" ? "assistant" : "user",
            content: m.text || (m.payload && m.payload.summary) || "",
          })),
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      setCurrentPhase("Resolviendo intención · el cóndor decide qué herramientas usar");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parsear NDJSON: cada evento termina en \n
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;

          let ev: any;
          try { ev = JSON.parse(line); } catch { continue; }

          if (ev.type === "tool_call") {
            toolsCalled.push(ev.tool);
            const nar = TOOL_NARRATIVE[ev.tool] || { phrase: ev.tool };
            setCurrentPhase(`${nar.phrase}…`);
            setCurrentTool(ev.tool);
            setActiveTools(t => [...t, ev.tool]);
          } else if (ev.type === "tool_result") {
            toolsFull.push({ tool: ev.tool, result_summary: ev.summary });
          } else if (ev.type === "delta") {
            // Primer delta: cerrar fase de pensamiento + crear burbuja de respuesta
            if (firstDelta) {
              firstDelta = false;
              setCurrentTool(null);
              setCurrentPhase("Escribiendo respuesta…");
              setThinking(false);
              setActiveTools([]);
              setMessages(m => [...m, {
                id: streamingId,
                role: "condor",
                kind: "answer",
                streaming: true,
                payload: {
                  summary: "",
                  tools: toolsCalled,
                  sources: [],
                  cost: { tokens: 0, time: "streaming…", price: "—" },
                },
                time: now(),
              }]);
            }
            accumulatedText += ev.text || "";
            // Actualizar el mensaje en streaming
            setMessages(m => m.map((msg: any) =>
              msg.id === streamingId
                ? { ...msg, payload: { ...msg.payload, summary: accumulatedText } }
                : msg
            ));
          } else if (ev.type === "done") {
            totalTokens = ev.tokens || 0;
            iterations = ev.iterations || 1;
            // Resultado final - cerrar streaming y enriquecer
            setMessages(m => m.map((msg: any) =>
              msg.id === streamingId
                ? {
                    ...msg,
                    streaming: false,
                    payload: {
                      ...msg.payload,
                      summary: accumulatedText || "Sin respuesta.",
                      tools: toolsCalled,
                      sources: toolsCalled.map(t => {
                        const nar = TOOL_NARRATIVE[t];
                        return nar ? `${nar.phrase} (${t})` : `Llamé tool '${t}'`;
                      }),
                      cost: {
                        tokens: totalTokens,
                        time: `${iterations} it`,
                        price: `~$${(totalTokens * 0.000002).toFixed(4)}`,
                      },
                    },
                  }
                : msg
            ));
          } else if (ev.type === "error") {
            throw new Error(ev.message || "error desconocido");
          }
        }
      }

      setCurrentPhase("");
      setThinking(false);
      setActiveTools([]);
      setCurrentTool(null);
    } catch (err: any) {
      setThinking(false);
      setActiveTools([]);
      setCurrentPhase("");
      setCurrentTool(null);
      // Si nunca creamos la burbuja de streaming, agregamos una de error
      const errorPayload = {
        summary: `Error consultando al backend: \`${err.message}\`. Verificá que FastAPI esté corriendo.`,
        tools: [], sources: [], cost: { tokens: 0, time: "0s", price: "$0" },
      };
      if (firstDelta) {
        setMessages(m => [...m, { role: "condor", kind: "answer", payload: errorPayload, time: now() }]);
      } else {
        setMessages(m => m.map((msg: any) =>
          msg.id === streamingId ? { ...msg, streaming: false, payload: errorPayload } : msg
        ));
      }
    }
  }

  const suggestions = ROLE_PROMPTS[role] || ROLE_PROMPTS.antifraude;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "100%", background: "var(--marfil)" }}>
      {/* main conversation column — el watermark global vive en page.tsx <main> */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, position: "relative", overflow: "hidden" }}>
        {/* central condor stage (shrinks when chat scrolls) */}
        <div style={{
          padding: "28px 48px 8px", display: "flex", alignItems: "center", gap: 18,
          borderBottom: "1px solid var(--line)",
          position: "relative", zIndex: 1, background: "var(--marfil)",
          overflow: "hidden",
        }}>
          {/* silueta decorativa en el header — más visible, alineada a la derecha */}
          <div style={{
            position: "absolute", right: -40, top: -10, bottom: -10,
            display: "flex", alignItems: "center",
            pointerEvents: "none", zIndex: 0,
          }}>
            <CondorSilhouette
              width={260}
              color="var(--mountain-blue)"
              style={{ opacity: 0.22 }}
            />
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <CondorLogo size={52} />
            <span style={{ position: "absolute", bottom: 2, right: 0, width: 10, height: 10, borderRadius: "50%", background: "var(--success)", border: "2px solid var(--bg-card)" }}/>
          </div>
          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <h2 className="display" style={{ fontSize: 22, marginBottom: 2, color: 'var(--text-primary)' }}>Conversación con el Cóndor</h2>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              Modelo: <span className="mono">gpt-5-mini</span> · 10 tools activas · contexto: cartera multi-ramo 39.960 siniestros (Vehículos · Hogar · Salud)
            </div>
          </div>
          <div className="chip blue" style={{ position: "relative", zIndex: 1 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--paramo-green)" }}/> Conectado a Azure
          </div>
        </div>

        {/* messages */}
        <div ref={scrollerRef} style={{ flex: 1, overflow: "auto", padding: "20px 48px 12px", position: "relative", zIndex: 1 }}>
          {messages.map((m, i) => (
            <Message key={i} msg={m} onInvestigate={onInvestigate} />
          ))}
          {thinking && <JarvisStream phase={currentPhase} tools={activeTools} currentTool={currentTool} />}
        </div>

        {/* prompt suggestions + input */}
        <div style={{ borderTop: "1px solid var(--line)", padding: "12px 48px 20px", background: "var(--marfil-paper)", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {suggestions.map((p, i) => (
              <button key={i}
                onClick={() => send(p)}
                className="btn ghost sm"
                style={{ fontSize: 11.5, padding: "6px 12px" }}>
                <FaPlay size={9} /> {p}
              </button>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--bg-card)", border: "1px solid var(--border-color)",
            borderRadius: 16, padding: "8px 8px 8px 16px",
            boxShadow: "var(--shadow-sm)",
          }}>
            <CondorLogo size={26} />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Pregúntale al cóndor…  (ej: ¿qué proveedor concentra más exposición?)"
              style={{
                flex: 1, border: 0, outline: 0, fontSize: 14, padding: "8px 0",
                background: "transparent", color: "var(--condor-wing)",
              }}
            />
            <button className="btn ghost" style={{ padding: "8px 10px" }} title="Voz"><FaMicrophone size={13} /></button>
            <button className="btn" onClick={() => send()} disabled={thinking}>
              Enviar →
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span>El cóndor sabe usar 10 tools · cada respuesta muestra sus fuentes</span>
            <span>↵ enviar · ⇧↵ nueva línea · / comandos</span>
          </div>
        </div>
      </div>

      {/* right side panel: history + capabilities */}
      <aside style={{ borderLeft: "1px solid var(--line)", background: "var(--marfil-paper)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "20px 18px 12px", borderBottom: "1px solid var(--line)" }}>
          <div className="diamond-divider">Histórico de hoy</div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "12px 18px" }}>
          <HistoryItem time="08:14" title="Resumen matinal de cartera" tools={2} />
          <HistoryItem time="08:42" title="Alerta proactiva PRV-NEW0019" tools={1} highlight />
          <HistoryItem time="09:05" title="Investigación SIN-100029" tools={8} red />
          <HistoryItem time="09:18" title="Comparar con casos similares" tools={2} />
          <HistoryItem time="09:24" title="Generar reporte ejecutivo" tools={1} />
          <div style={{ height: 18 }}/>
          <div className="diamond-divider">Esta semana</div>
          <HistoryItem time="lun" title="Auditoría casos RF-03 marzo" tools={3} />
          <HistoryItem time="mar" title="Mapa exposición Quito" tools={2} />
          <HistoryItem time="mié" title="Simulación threshold 0.75" tools={1} />
        </div>
        <div style={{ padding: "14px 18px 18px", borderTop: "1px solid var(--line)" }}>
          <div className="diamond-divider" style={{ marginBottom: 10 }}>Capacidades</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {TOOLS_CATALOG.map(t => (
              <span key={t} className="chip" style={{ fontSize: 10, padding: "3px 7px", background: "white" }}>
                <span className="mono">{t}</span>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginTop: 10 }}>
            + multimodal: facturas (Azure DI), fotos (GPT-4o Vision), embeddings, grafo de relaciones.
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ---------- helpers ---------- */
function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---------- subviews ---------- */
function HistoryItem({ time, title, tools, highlight, red }) {
  return (
    <div className="fade-up" style={{
      padding: "10px 12px", marginBottom: 6, borderRadius: 10,
      background: highlight ? "rgba(232,122,79,0.10)" : red ? "rgba(197,51,58,0.08)" : "white",
      border: "1px solid var(--line)", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", width: 30 }}>{time}</div>
      <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{title}</div>
      <span className="chip" style={{ fontSize: 9, padding: "2px 6px" }}>{tools} tools</span>
    </div>
  );
}

function ThinkingBlock({ tools }) {
  return (
    <div className="fade-up" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <CondorLogo size={32} />
      <div style={{ flex: 1, maxWidth: 720 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--accent)", marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-amber 1.2s infinite' }} /> consultando {tools.length || "…"} fuentes…
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tools.map((t, i) => (
            <span key={i} className="chip" style={{
              fontSize: 10.5, padding: "4px 10px",
              background: "rgba(232,122,79,0.10)",
              color: "var(--andes-orange)",
              animation: i === tools.length - 1 ? "shimmer 1.2s linear infinite" : "none",
              backgroundImage: i === tools.length - 1 ? "linear-gradient(90deg, rgba(232,122,79,0.1), rgba(232,122,79,0.3), rgba(232,122,79,0.1))" : "none",
              backgroundSize: "200% 100%",
            }}>
              <span className="mono">{t}</span>
              {i < tools.length - 1 && <FaCheckCircle size={9} style={{ marginLeft: 4, color: 'var(--success)' }} />}
            </span>
          ))}
          {tools.length === 0 && (
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-mute)", padding: "4px 0" }}>
              planeando…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ msg, onInvestigate }) {
  if (msg.role === "user") {
    return (
      <div className="fade-up" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{
          maxWidth: 520, padding: "10px 16px", borderRadius: "16px 16px 4px 16px",
          background: "var(--condor-wing)", color: "var(--marfil)", fontSize: 13.5, lineHeight: 1.5,
        }}>
          {msg.text}
          <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 4 }}>{msg.time}</div>
        </div>
      </div>
    );
  }

  if (msg.kind === "answer") {
    const a = msg.payload;
    return (
      <div className="fade-up" style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <CondorLogo size={32} />
        <div style={{ flex: 1, maxWidth: 760 }}>
          <div style={{
            background: "white", border: "1px solid var(--line)",
            borderRadius: "4px 16px 16px 16px", overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ padding: "14px 18px 4px" }}>
              <MD>{a.summary}</MD>
            </div>

            {/* Evidencia visual auto-detectada en el texto: tarjetas Vuelo del Cóndor */}
            <EvidencePreview summary={a.summary} onInvestigate={onInvestigate} />

            {/* Mapa de calor de Ecuador cuando el agente uso ranking_ciudades */}
            {a.tools?.includes("ranking_ciudades") && (
              <CityHeatmapAuto />
            )}

            {/* Botón de descarga cuando el agente generó un reporte PDF */}
            {a.reporteResult && <ReportePdfCard r={a.reporteResult} />}

            {/* Card de evaluación cuando el agente evaluó un caso hipotético */}
            {a.evaluacionResult && <EvaluacionCard e={a.evaluacionResult} onInvestigate={onInvestigate} />}

            {a.tableRows && (
              <div style={{ padding: "10px 18px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      {a.tableHeaders.map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 6px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-mute)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.tableRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                        {row.map((c, j) => (
                          <td key={j} style={{ padding: "10px 6px", verticalAlign: "middle" }}>
                            {j === row.length - 1
                              ? <VueloDelCondor score={c} variant="sm" />
                              : <span className={j === 2 ? "tabular mono" : ""} style={{ fontSize: 12.5 }}>{c}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {a.chart && <MiniBarChart />}

            {/* sources */}
            <details style={{ borderTop: "1px solid var(--line)", padding: "10px 18px", background: "var(--marfil-paper)" }}>
              <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--mountain-blue)", fontWeight: 600 }}>
                ▾ ¿Cómo llegué a esto?
              </summary>
              <ul style={{ margin: "8px 0 4px 16px", padding: 0, fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
                {a.sources.map((s, i) => <li key={i}><FaBolt size={9} style={{ marginRight: 4 }} /> {s}</li>)}
              </ul>
              <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: "var(--text-secondary)", marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border-color)" }}>
                <span>{a.cost.time}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FaCoins size={10} /> {a.cost.tokens} tokens</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FaDollarSign size={10} /> {a.cost.price}</span>
                <span style={{ flex: 1 }}/>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FaCog size={10} /> {a.tools.map(t => <span key={t} className="mono" style={{ marginLeft: 4 }}>[{t}]</span>)}</span>
              </div>
            </details>

            {a.tableRows && (
              <div style={{ padding: "10px 18px", display: "flex", gap: 8, borderTop: "1px solid var(--line)", background: "var(--marfil-paper)" }}>
                <button className="chip green" style={{ cursor: "pointer" }}><FaLightbulb size={10} /> Sugerencia: revisar PRV-NEW0019</button>
                <button className="btn ghost sm" onClick={() => onInvestigate && onInvestigate("SIN-100029")}><FaSearch size={10} /> Investigar profundo</button>
                <div style={{ flex: 1 }}/>
                <button className="btn ghost sm" aria-label="Útil"><FaThumbsUp size={11} /></button>
                <button className="btn ghost sm" aria-label="No útil"><FaThumbsDown size={11} /></button>
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>{msg.time}</div>
        </div>
      </div>
    );
  }

  // greeting / proactive
  return (
    <div className="fade-up" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <CondorLogo size={32} />
      <div style={{ flex: 1, maxWidth: 560 }}>
        <div style={{
          background: msg.kind === "proactive" ? "rgba(232,122,79,0.10)" : "white",
          border: msg.kind === "proactive" ? "1px solid rgba(232,122,79,0.30)" : "1px solid var(--line)",
          padding: "12px 16px",
          borderRadius: "4px 16px 16px 16px",
          fontSize: 13.5, lineHeight: 1.55,
          boxShadow: "var(--shadow-sm)",
        }}>
          {msg.kind === "proactive" && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--andes-orange)", letterSpacing: ".1em", marginBottom: 4 }}>
              <FaLightbulb size={11} style={{ marginRight: 6, verticalAlign: 'middle' }} /> SUGERENCIA PROACTIVA
            </div>
          )}
          {msg.text}
          {msg.actions && (
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {msg.actions.map((a, i) => (
                <button key={i} className={i === 0 ? "btn" : "btn ghost"} style={{ padding: "6px 12px", fontSize: 11.5 }}>{a}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>{msg.time}</div>
      </div>
    </div>
  );
}

function MiniBarChart() {
  const bars = [156, 132, 98, 76, 54];
  const max = 160;
  return (
    <div style={{ padding: "0 18px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70, paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-mute)" }}>${b}K</div>
            <div style={{
              width: "100%", height: `${(b / max) * 100}%`,
              background: i === 0 ? "var(--guayaba-red)" : i === 1 ? "var(--guayaba-soft)" : "var(--andes-ocher)",
              borderRadius: "4px 4px 0 0",
            }}/>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {["NEW19", "0007", "0042", "0019", "0103"].map(c => (
          <div key={c} className="mono" style={{ flex: 1, textAlign: "center", fontSize: 9, color: "var(--ink-mute)" }}>{c}</div>
        ))}
      </div>
    </div>
  );
}

