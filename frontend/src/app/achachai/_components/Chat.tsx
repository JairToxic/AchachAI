'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Condor, VueloDelCondor } from './Condor';

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
    <code style={{ background: 'rgba(6, 182, 212, 0.10)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11.5 }}>{children}</code>
  ),
  h1: ({ children }: any) => <h3 style={{ fontSize: 16, margin: '10px 0 6px', fontWeight: 600 }}>{children}</h3>,
  h2: ({ children }: any) => <h3 style={{ fontSize: 15, margin: '10px 0 6px', fontWeight: 600 }}>{children}</h3>,
  h3: ({ children }: any) => <h4 style={{ fontSize: 14, margin: '8px 0 4px', fontWeight: 600 }}>{children}</h4>,
};

function MD({ children }: { children: string }) {
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
const TOOL_NARRATIVE: Record<string, { phrase: string; icon: string; tone: string; detail: string }> = {
  top_riesgo:                { phrase: "Escaneando casos críticos",       icon: "📡", tone: "#C5333A", detail: "Aplicando scoring híbrido (reglas + XGBoost) a 25.460 siniestros…" },
  detalle_siniestro:         { phrase: "Recuperando detalle del caso",    icon: "🔍", tone: "#E87A4F", detail: "Cruzando póliza + asegurado + vehículo + proveedor + documentos…" },
  ranking_proveedores:       { phrase: "Calculando concentración por proveedor", icon: "🕸️", tone: "#2C5F8D", detail: "Agregando casos por proveedor en últimos 90 días…" },
  ranking_ciudades:          { phrase: "Mapeando geografía del fraude",   icon: "🗺️", tone: "#2C5F8D", detail: "Agrupando casos por ciudad y calculando densidad…" },
  asegurados_recurrentes:    { phrase: "Detectando clientes frecuentes",  icon: "👥", tone: "#D4A574", detail: "Buscando asegurados con múltiples reclamos en 18 meses…" },
  docs_faltantes:            { phrase: "Auditando completitud documental", icon: "📄", tone: "#D4A574", detail: "Listando casos con documentos faltantes o ilegibles…" },
  montos_atipicos:           { phrase: "Identificando montos anómalos",   icon: "💰", tone: "#C5333A", detail: "Filtrando reclamos cercanos al 95% de suma asegurada…" },
  estadisticas_por_cobertura:{ phrase: "Analizando por tipo de cobertura", icon: "📊", tone: "#2C5F8D", detail: "Calculando % fraude por ramo y monto promedio…" },
  simulacion_ahorro:         { phrase: "Calculando ROI y proyección $$$", icon: "💵", tone: "#4A7C59", detail: "Estimando ahorro anual con tasa de detección AchachAI…" },
  exportar_reporte:          { phrase: "Preparando reporte de auditoría", icon: "📋", tone: "#1A3A52", detail: "Generando CSV con casos del nivel solicitado…" },
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
      borderRadius: "50%", background: "radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, rgba(6, 182, 212, 0.02) 70%, transparent 100%)",
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

function JarvisStream({ phase, tools, currentTool }: { phase: string; tools: string[]; currentTool?: string }) {
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
          border: "1px solid rgba(6, 182, 212, 0.40)",
          position: "relative", overflow: "hidden",
        }}>
          {/* scan line decorativa */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(180deg, transparent, rgba(6, 182, 212, 0.08), transparent)",
            backgroundSize: "100% 200%",
            animation: "scan-beam 3s linear infinite",
          }}/>

          {/* Header HUD */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, position: "relative" }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: ".18em", color: "var(--andes-orange)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--andes-orange)", boxShadow: "0 0 8px var(--andes-orange)", animation: "pulse-red 0.8s infinite" }}/>
              TRANSMISIÓN EN VIVO
            </div>
            <span style={{ flex: 1 }}/>
            <span className="mono" style={{ fontSize: 9.5, color: "rgba(203, 213, 225,0.5)", letterSpacing: ".1em" }}>
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
          <div style={{ height: 3, background: "rgba(203, 213, 225,0.1)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
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
                const nar = TOOL_NARRATIVE[t] || { phrase: t, icon: "⚡", tone: "#E87A4F", detail: "Procesando…" };
                const isCurrent = i === tools.length - 1 && t === currentTool;
                const isDone = !isCurrent;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "9px 11px", borderRadius: 8,
                    background: isCurrent ? "rgba(6, 182, 212, 0.20)" : "rgba(203, 213, 225,0.05)",
                    border: `1px solid ${isCurrent ? "rgba(6, 182, 212, 0.55)" : "rgba(203, 213, 225,0.08)"}`,
                    animation: isCurrent ? "fade-up .25s ease both" : "none",
                  }}>
                    <span style={{ fontSize: 16, marginTop: 1 }}>{nar.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--marfil)" }}>{nar.phrase}</span>
                        <span className="mono" style={{ fontSize: 9.5, color: "rgba(203, 213, 225,0.55)", letterSpacing: ".06em" }}>[{t}]</span>
                        <span style={{ flex: 1 }}/>
                        {isDone && (
                          <span className="mono" style={{ fontSize: 10, color: "var(--paramo-soft)", fontWeight: 600 }}>
                            ✓ {(180 + i * 50 + Math.floor(Math.random() * 80)).toString()}ms
                          </span>
                        )}
                        {isCurrent && (
                          <span className="mono" style={{ fontSize: 10, color: "var(--andes-orange)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--andes-orange)", animation: "pulse-red 0.6s infinite" }}/>
                            EJECUTANDO
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(203, 213, 225,0.7)", marginTop: 2, lineHeight: 1.4 }}>{nar.detail}</div>
                      {isCurrent && (
                        <div style={{ marginTop: 6, height: 2, background: "rgba(203, 213, 225,0.08)", borderRadius: 2, overflow: "hidden" }}>
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
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "rgba(203, 213, 225,0.8)" }}>
                EL CÓNDOR ESTÁ DECIDIENDO QUÉ TOOLS USAR…
              </span>
            </div>
          )}

          {/* Footer mini stats */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(203, 213, 225,0.12)",
            fontSize: 9.5, color: "rgba(203, 213, 225,0.5)", letterSpacing: ".06em",
          }}>
            <span className="mono">CARTERA · 25.460 SINIESTROS · 198 PROVEEDORES</span>
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
const SCORE_REGEX = /\b(\d{1,3})\s*\/\s*100\b/g;

function extractEvidence(text: string): { ids: string[]; provs: string[]; scores: number[]; niveles: string[] } {
  return {
    ids: Array.from(new Set((text.match(ID_REGEX) || []))),
    provs: Array.from(new Set((text.match(PROV_REGEX) || []))),
    scores: Array.from(new Set((text.match(SCORE_REGEX) || []).map(s => parseInt(s)))),
    niveles: Array.from(new Set((text.match(NIVEL_REGEX) || []))),
  };
}

/* Genera un score determinístico (estable) a partir del id para que se vea consistente */
function scoreFromId(id: string, fallback: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  // mantener cerca del fallback ±10
  const jitter = (hash % 21) - 10;
  return Math.max(0, Math.min(100, fallback + jitter));
}

function EvidencePreview({ summary, onInvestigate }: { summary: string; onInvestigate?: (id: string) => void }) {
  const ev = extractEvidence(summary);
  if (ev.ids.length === 0 && ev.provs.length === 0) return null;

  // Score base por mención de nivel
  const baseScore = ev.niveles.includes("ROJO") ? 80
                  : ev.niveles.includes("AMARILLO") ? 52 : 22;

  // Hasta 6 casos detectados → cada uno con score estable
  const cards = ev.ids.slice(0, 6).map((id, i) => ({
    id,
    score: ev.scores[i] || scoreFromId(id, baseScore),
  }));

  return (
    <div style={{
      padding: "16px 18px 18px",
      background: "linear-gradient(180deg, var(--marfil-paper), var(--marfil))",
      borderTop: "1px solid var(--line)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          display: "inline-block", width: 22, height: 22, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--andes-orange), var(--guayaba-red))",
          display: "grid", placeItems: "center", color: "white", fontSize: 12,
        }}>🦅</span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--condor-wing)" }}>
            Evidencia visual auto-detectada
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".06em" }}>
            {cards.length} caso(s) · {ev.provs.length} proveedor(es) · {ev.niveles.length} nivel(es)
          </div>
        </div>
        <span style={{ flex: 1 }}/>
        <span className="chip outline" style={{ fontSize: 9.5, background: "rgba(11, 30, 51, 0.55)" }}>click → investigar</span>
      </div>

      {cards.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: ev.provs.length > 0 ? 14 : 0 }}>
          {cards.map(c => {
            const level = c.score >= 70 ? "red" : c.score >= 40 ? "amber" : "green";
            const accent = level === "red" ? "var(--guayaba-red)" : level === "amber" ? "var(--andes-ocher)" : "var(--paramo-green)";
            return (
              <button key={c.id}
                onClick={() => onInvestigate && onInvestigate(c.id)}
                style={{
                  cursor: "pointer", background: "rgba(11, 30, 51, 0.55)",
                  border: `1px solid ${accent}40`,
                  borderTop: `3px solid ${accent}`,
                  borderRadius: 12, padding: "12px 14px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  transition: "transform .15s, box-shadow .15s, border-color .15s",
                  minWidth: 130,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <VueloDelCondor score={c.score} variant="sm" />
                <span className="mono" style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: ".04em" }}>{c.id}</span>
                <span style={{ fontSize: 10, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 3 }}>
                  🦅 investigar profundo
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
            }}>🏢 {p}</span>
          ))}
          {ev.niveles.map(n => {
            const cls = n === "ROJO" ? "red" : n === "AMARILLO" ? "amber" : "green";
            const icon = n === "ROJO" ? "🔴" : n === "AMARILLO" ? "🟡" : "🟢";
            return (
              <span key={n} className={`chip ${cls}`} style={{ fontSize: 10.5, padding: "3px 9px", fontWeight: 600 }}>
                {icon} {n}
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
      "Consulté tabla 'siniestros' (25.460 registros)",
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

    // Fase 1: pre-fetch — el cóndor "piensa" antes de mandar al backend
    setCurrentPhase("🛫 Despegando · conectando con Azure AI Foundry…");
    await sleep(380);
    setCurrentPhase("🧠 Resolviendo intención · decidiendo qué herramientas usar");
    await sleep(420);

    // Lanzar el request al backend en paralelo con animación
    const fetchPromise = fetch(`${API}/chat`, {
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

    setCurrentPhase("📡 Conectando con la base de 25.460 siniestros…");

    try {
      const resp = await fetchPromise;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const tools = (data.tools_used || []).map(t => t.tool);

      // Fase 2: stream visual de cada tool
      for (let i = 0; i < tools.length; i++) {
        const nar = TOOL_NARRATIVE[tools[i]] || { phrase: tools[i] };
        setCurrentPhase(`${nar.phrase}…`);
        setCurrentTool(tools[i]);
        setActiveTools(t => [...t, tools[i]]);
        await sleep(450 + Math.random() * 200);
      }

      // Fase 3: síntesis
      setCurrentTool(null);
      setCurrentPhase("✨ Sintetizando insights · construyendo respuesta…");
      await sleep(600);

      setThinking(false);
      setActiveTools([]);
      setCurrentPhase("");

      const payload = {
        summary: data.response || "Sin respuesta.",
        tools: tools,
        sources: tools.map(t => {
          const nar = TOOL_NARRATIVE[t];
          return nar ? `${nar.icon} ${nar.phrase} (${t})` : `Llamé tool '${t}'`;
        }),
        cost: {
          tokens: data.tokens || 0,
          time: `${data.iterations || 1} it`,
          price: `~$${((data.tokens || 0) * 0.000002).toFixed(4)}`,
        },
      };
      setMessages(m => [...m, { role: "condor", kind: "answer", payload, time: now() }]);
    } catch (err) {
      setThinking(false);
      setActiveTools([]);
      setCurrentPhase("");
      setCurrentTool(null);
      setMessages(m => [...m, {
        role: "condor",
        kind: "answer",
        payload: {
          summary: `⚠️ Error consultando al backend: \`${err.message}\`. Verificá que FastAPI esté corriendo en \`localhost:8000\`.`,
          tools: [], sources: [], cost: { tokens: 0, time: "0s", price: "$0" },
        },
        time: now(),
      }]);
    }
  }

  const suggestions = ROLE_PROMPTS[role] || ROLE_PROMPTS.antifraude;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "100%", background: "var(--marfil)" }}>
      {/* main conversation column */}
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
        {/* central condor stage (shrinks when chat scrolls) */}
        <div style={{
          padding: "28px 48px 8px", display: "flex", alignItems: "center", gap: 18,
          borderBottom: "1px solid var(--line)",
        }}>
          <div style={{ position: "relative" }}>
            <Condor size={56} mood={thinking ? "think" : "idle"} tone="wing" />
            <span style={{ position: "absolute", bottom: 0, right: -2, width: 10, height: 10, borderRadius: "50%", background: "var(--paramo-green)", border: "2px solid var(--marfil)" }}/>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 22, marginBottom: 2 }}>Conversación con el Cóndor</h2>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              Modelo: <span className="mono">gpt-5-mini</span> · 10 tools activas · contexto: cartera vehicular 25.460 siniestros
            </div>
          </div>
          <div className="chip blue">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--paramo-green)" }}/> Conectado a Azure
          </div>
        </div>

        {/* messages */}
        <div ref={scrollerRef} style={{ flex: 1, overflow: "auto", padding: "20px 48px 12px" }}>
          {messages.map((m, i) => (
            <Message key={i} msg={m} onInvestigate={onInvestigate} />
          ))}
          {thinking && <JarvisStream phase={currentPhase} tools={activeTools} currentTool={currentTool} />}
        </div>

        {/* prompt suggestions + input */}
        <div style={{ borderTop: "1px solid var(--line)", padding: "12px 48px 20px", background: "var(--marfil-paper)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {suggestions.map((p, i) => (
              <button key={i}
                onClick={() => send(p)}
                className="chip outline"
                style={{ cursor: "pointer", fontSize: 11.5, padding: "6px 12px", background: "rgba(11, 30, 51, 0.55)" }}>
                <Condor size={12} tone="wing" mood="still" /> {p}
              </button>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(11, 30, 51, 0.55)", border: "1px solid var(--line-strong)",
            borderRadius: 16, padding: "8px 8px 8px 16px",
            boxShadow: "var(--shadow-sm)",
          }}>
            <Condor size={20} tone="orange" mood="idle" />
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
            <button className="btn ghost" style={{ padding: "8px 10px" }} title="Voz">🎙</button>
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
              <span key={t} className="chip" style={{ fontSize: 10, padding: "3px 7px", background: "rgba(11, 30, 51, 0.55)" }}>
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
      background: highlight ? "rgba(6, 182, 212, 0.10)" : red ? "rgba(239, 68, 68, 0.08)" : "rgba(11, 30, 51, 0.55)",
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
      <Condor size={28} mood="think" tone="orange" />
      <div style={{ flex: 1, maxWidth: 720 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--andes-orange)", marginBottom: 8 }}>
          <Condor size={11} tone="orange" mood="still"/> consultando {tools.length || "…"} fuentes…
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tools.map((t, i) => (
            <span key={i} className="chip" style={{
              fontSize: 10.5, padding: "4px 10px",
              background: "rgba(6, 182, 212, 0.12)",
              color: "var(--andes-orange)",
              animation: i === tools.length - 1 ? "shimmer 1.2s linear infinite" : "none",
              backgroundImage: i === tools.length - 1 ? "linear-gradient(90deg, rgba(6, 182, 212, 0.12), rgba(6, 182, 212, 0.40), rgba(6, 182, 212, 0.12))" : "none",
              backgroundSize: "200% 100%",
            }}>
              <span className="mono">{t}</span>
              {i < tools.length - 1 && <span style={{ marginLeft: 4 }}>✓</span>}
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
        <Condor size={28} mood="speak" tone="wing" />
        <div style={{ flex: 1, maxWidth: 760 }}>
          <div style={{
            background: "rgba(11, 30, 51, 0.55)", border: "1px solid var(--line)",
            borderRadius: "4px 16px 16px 16px", overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ padding: "14px 18px 4px" }}>
              <MD>{a.summary}</MD>
            </div>

            {/* Evidencia visual auto-detectada en el texto: tarjetas Vuelo del Cóndor */}
            <EvidencePreview summary={a.summary} onInvestigate={onInvestigate} />

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
                {a.sources.map((s, i) => <li key={i}>⚡ {s}</li>)}
              </ul>
              <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: "var(--ink-mute)", marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--line)" }}>
                <span>⏱ {a.cost.time}</span>
                <span>🪙 {a.cost.tokens} tokens</span>
                <span>💵 {a.cost.price}</span>
                <span style={{ flex: 1 }}/>
                <span>🔧 {a.tools.map(t => <span key={t} className="mono" style={{ marginLeft: 4 }}>[{t}]</span>)}</span>
              </div>
            </details>

            {a.tableRows && (
              <div style={{ padding: "10px 18px", display: "flex", gap: 8, borderTop: "1px solid var(--line)", background: "var(--marfil-paper)" }}>
                <button className="chip green" style={{ cursor: "pointer" }}>💡 Sugerencia: revisar PRV-NEW0019</button>
                <button className="chip outline" style={{ cursor: "pointer" }} onClick={() => onInvestigate && onInvestigate("SIN-100029")}>🦅 Investigar profundo</button>
                <div style={{ flex: 1 }}/>
                <button className="chip outline" style={{ cursor: "pointer" }}>👍</button>
                <button className="chip outline" style={{ cursor: "pointer" }}>👎</button>
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
      <Condor size={28} mood={msg.kind === "proactive" ? "alert" : "idle"} tone={msg.kind === "proactive" ? "orange" : "wing"} />
      <div style={{ flex: 1, maxWidth: 560 }}>
        <div style={{
          background: msg.kind === "proactive" ? "rgba(6, 182, 212, 0.12)" : "white",
          border: msg.kind === "proactive" ? "1px solid rgba(6, 182, 212, 0.40)" : "1px solid var(--line)",
          padding: "12px 16px",
          borderRadius: "4px 16px 16px 16px",
          fontSize: 13.5, lineHeight: 1.55,
          boxShadow: "var(--shadow-sm)",
        }}>
          {msg.kind === "proactive" && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--andes-orange)", letterSpacing: ".1em", marginBottom: 4 }}>
              💡 SUGERENCIA PROACTIVA
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

