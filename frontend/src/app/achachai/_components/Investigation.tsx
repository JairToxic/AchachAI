'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Condor, VueloDelCondor } from './Condor';

const useInvState = useState;
const useInvEffect = useEffect;
const useInvRef = useRef;

/* ============================================================
   MODO INVESTIGACIÓN PROFUNDA — the wow demo (~30s orchestration)
   ============================================================ */

export const BITACORA = [
  { t: "00:01", icon: "🦅", text: "Recuperando datos del siniestro SIN-100029…", flag: "ok" },
  { t: "00:03", icon: "📊", text: "Calculando score con XGBoost (Azure ML endpoint v4)…", flag: "ok" },
  { t: "00:04", icon: "📋", text: "Aplicando 7 reglas críticas + 14 señales…", flag: "ok",
    detail: ["RF-01 (PTxRB) activa", "3 señales activas (+15 pts)"] },
  { t: "00:06", icon: "📄", text: "Analizando factura del taller con Azure Document Intelligence…", flag: "warn",
    detail: ["Factura emitida 14 días ANTES del siniestro"] },
  { t: "00:09", icon: "🚗", text: "Analizando foto del daño con GPT-4o Vision…", flag: "warn",
    detail: ["Daño visible: lateral derecho menor", "Narrativa dice: «impacto frontal severo»", "Inconsistencia confirmada"] },
  { t: "00:12", icon: "👮", text: "Verificando parte policial con Azure DI OCR…", flag: "warn",
    detail: ["No se detecta sello oficial", "Número de expediente con formato sospechoso"] },
  { t: "00:14", icon: "🔍", text: "Buscando narrativas similares (embeddings)…", flag: "warn",
    detail: ["3 casos con similitud > 0.94", "Todos del mismo proveedor PRV-NEW0019"] },
  { t: "00:16", icon: "🕸", text: "Analizando red de relaciones…", flag: "warn",
    detail: ["PRV-NEW0019 en 8 casos del último mes", "Conectado a 5 asegurados distintos"] },
  { t: "00:18", icon: "💰", text: "Calculando exposición al proveedor…", flag: "warn",
    detail: ["$156K USD en reclamos vinculados a PRV-NEW0019"] },
  { t: "00:20", icon: "✨", text: "Sintetizando informe ejecutivo 360°…", flag: "ok" },
];

export const REPORT_SECTIONS = [6, 7, 8, 9, 10]; // step index at which each section appears
// We'll just unlock sections progressively as steps complete:
// 1. Summary: step 0
// 2. Documental evidence: step 3
// 3. Patterns: step 6
// 4. Network: step 7
// 5. Chronology: step 8
// 6. Actions: step 9

export function InvestigationScreen({ caseId = "SIN-100029", onBack }) {
  const [step, setStep] = useInvState(-1);
  const [running, setRunning] = useInvState(false);
  const [committee, setCommittee] = useInvState(false);
  const logRef = useInvRef(null);

  // auto-start on mount
  useInvEffect(() => { start(); /* eslint-disable-next-line */ }, []);

  useInvEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [step]);

  async function start() {
    setRunning(true);
    setStep(-1);
    for (let i = 0; i < BITACORA.length; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 600 : 1200));
      setStep(i);
    }
    setRunning(false);
  }

  function reset() { start(); }

  const showSummary = step >= 0;
  const showDocs = step >= 3;
  const showPatterns = step >= 6;
  const showNetwork = step >= 7;
  const showChrono = step >= 8;
  const showActions = step >= 9;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--marfil)" }}>
      {/* header */}
      <div style={{
        padding: "20px 32px", borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "center", gap: 18,
        background: "linear-gradient(180deg, rgba(197,51,58,0.06), transparent)",
      }}>
        <button className="btn ghost" onClick={onBack} style={{ padding: "6px 10px", fontSize: 12 }}>← Volver</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--andes-orange)", fontWeight: 700, textTransform: "uppercase" }}>
            🦅 Modo Investigación Profunda
          </div>
          <h2 style={{ fontSize: 24, marginTop: 2 }}>
            {caseId} · Auto 2019 · <span style={{ color: "var(--ink-mute)", fontFamily: "var(--sans)", fontWeight: 400, fontSize: 16 }}>colisión lateral · Quito Norte</span>
          </h2>
        </div>
        <VueloDelCondor score={87} variant="md" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn ghost" onClick={() => setCommittee(c => !c)} style={{ fontSize: 11 }}>
            {committee ? "Salir Modo Comité" : "🎬 Modo Comité"}
          </button>
          <button className="btn ghost" onClick={reset} style={{ fontSize: 11 }} disabled={running}>
            ↻ Reproducir investigación
          </button>
        </div>
      </div>

      {/* body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: committee ? "1fr" : "380px 1fr", minHeight: 0 }}>
        {/* bitácora */}
        {!committee && (
          <div style={{
            borderRight: "1px solid var(--line)", background: "var(--marfil-paper)",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            <div style={{ padding: "16px 20px 8px" }}>
              <div className="diamond-divider">Bitácora del cóndor</div>
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>
                {running ? <><span style={{ color: "var(--andes-orange)" }}>● en vuelo</span> · paso {step + 1} de {BITACORA.length}</>
                         : <>✓ {BITACORA.length} pasos completados</>}
              </div>
            </div>
            <div ref={logRef} style={{ flex: 1, overflow: "auto", padding: "12px 20px 20px" }}>
              {BITACORA.slice(0, step + 1).map((b, i) => (
                <BitacoraStep key={i} b={b} latest={i === step && running} />
              ))}
              {running && step >= 0 && step < BITACORA.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, color: "var(--ink-mute)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--andes-orange)", animation: "pulse-amber 1s infinite" }}/>
                  cóndor pensando…
                </div>
              )}
            </div>
          </div>
        )}

        {/* informe */}
        <div style={{ overflow: "auto", padding: committee ? "32px 64px" : "20px 28px", minHeight: 0 }}>
          {!showSummary && (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--ink-mute)" }}>
              <div style={{ textAlign: "center" }}>
                <Condor size={64} mood="alert" tone="red" />
                <div style={{ marginTop: 12 }}>El cóndor despega…</div>
              </div>
            </div>
          )}

          {showSummary && (
            <ReportSection n={1} title="Resumen ejecutivo" tone="red">
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, alignItems: "center" }}>
                <VueloDelCondor score={87} variant="lg" sublabel="Confianza ALTA · 96% modelo + 4 evidencias" />
                <div>
                  <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                    "Patrón clásico de fraude organizado con proveedor recurrente y documentación adulterada.
                    Requiere bloqueo de pago y apertura de investigación al proveedor."
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <span className="chip red">proveedor recurrente</span>
                    <span className="chip red">factura adulterada</span>
                    <span className="chip amber">narrativa incongruente</span>
                    <span className="chip amber">parte policial dudoso</span>
                    <span className="chip blue">3 casos similares</span>
                  </div>
                </div>
              </div>
            </ReportSection>
          )}

          {showDocs && (
            <ReportSection n={2} title="Evidencia documental" sub="Azure Document Intelligence + GPT-4o Vision">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <EvidenceCard title="Factura del taller" type="PDF · invoice-prebuilt" findings={[
                  ["⚠️", "Fecha emisión 14 días ANTES del evento"],
                  ["⚠️", "Total no coincide con subtotal + IVA"],
                  ["✓", "RUC válido"],
                ]} />
                <EvidenceCard title="Parte policial" type="PDF · OCR + LLM" findings={[
                  ["⚠️", "Sin sello oficial detectado"],
                  ["⚠️", "Nº expediente con formato atípico"],
                  ["✓", "Fecha coincide con siniestro"],
                ]} />
                <EvidenceCard title="Foto del daño" type="JPG · GPT-4o Vision" findings={[
                  ["⚠️", "Daño visible: lateral menor"],
                  ["⚠️", "Narrativa: «frontal severo»"],
                  ["⚠️", "Inconsistencia confirmada"],
                ]} hero />
              </div>
            </ReportSection>
          )}

          {showPatterns && (
            <ReportSection n={3} title="Patrones similares" sub="text-embedding-3-large · cosine ≥ 0.94">
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  ["SIN-100456", 0.96, "PRV-NEW0019", "Quito Norte · Auto 2018 · colisión lateral"],
                  ["SIN-100789", 0.95, "PRV-NEW0019", "Cumbayá · Auto 2020 · pérdida total"],
                  ["SIN-101023", 0.94, "PRV-NEW0019", "Tumbaco · Auto 2019 · colisión trasera"],
                ].map(([id, sim, prv, ctx]) => (
                  <div key={id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", background: "var(--marfil-paper)", borderRadius: 10,
                    border: "1px solid var(--line)",
                  }}>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--mountain-blue)" }}>{id}</div>
                    <SimBar value={sim} />
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", flex: 1 }}>{ctx}</div>
                    <span className="chip red mono" style={{ fontSize: 10 }}>{prv}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--andes-orange)", fontWeight: 600 }}>
                → Posible red organizada
              </div>
            </ReportSection>
          )}

          {showNetwork && (
            <ReportSection n={4} title="Red de relaciones" sub="Tejido del fraude · cluster proveedor">
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "center" }}>
                <MiniTejido />
                <div>
                  <div style={{ fontSize: 17, fontFamily: "var(--serif)", color: "var(--condor-wing)" }}>
                    PRV-NEW0019 · <span style={{ color: "var(--ink-mute)" }}>"Auto Servicio Andes"</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
                    <Stat label="Casos último mes" value="8" />
                    <Stat label="Asegurados distintos" value="5" />
                    <Stat label="Exposición total" value="$156K" tone="red" />
                  </div>
                  <button className="btn ghost" style={{ marginTop: 16, fontSize: 11 }}>Ver Tejido del Fraude completo →</button>
                </div>
              </div>
            </ReportSection>
          )}

          {showChrono && (
            <ReportSection n={5} title="Cronología del caso">
              <Timeline items={[
                ["2024-08-01", "Factura emitida", "anómalo — antes del evento", "red"],
                ["2024-08-15", "Siniestro reportado", "Quito Norte · 14:32", "wing"],
                ["2024-08-22", "Reclamo presentado", "documentación adjunta", "wing"],
                ["2024-08-25", "Pago aprobado pendiente", "$8.450 USD · esperando libera ción", "amber"],
              ]}/>
            </ReportSection>
          )}

          {showActions && (
            <ReportSection n={6} title="Acciones recomendadas" tone="orange">
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  ["BLOQUEAR pago pendiente del caso", "Inmediato · evita $8.450"],
                  ["ABRIR investigación al proveedor", "PRV-NEW0019 — concentra 5 asegurados"],
                  ["REVISAR los 7 casos vinculados", "potencial recuperación $148K"],
                  ["Considerar agregar PRV-NEW0019 a lista restrictiva", "decisión humana"],
                ].map(([t, sub], i) => (
                  <label key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", background: "white", borderRadius: 10,
                    border: "1px solid var(--line)", cursor: "pointer",
                  }}>
                    <input type="checkbox" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{i + 1}. {t}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{
                marginTop: 14, fontSize: 11.5, color: "var(--ink-mute)", padding: "10px 12px",
                background: "var(--marfil-paper)", borderRadius: 8, borderLeft: "3px solid var(--andes-orange)",
              }}>
                ⚠️ Esto es una recomendación. La decisión final es del analista humano.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button className="btn">⬇ Exportar PDF firmado</button>
                <button className="btn warm">📤 Enviar al comité antifraude</button>
                <button className="btn ghost">💬 Preguntar más al cóndor</button>
              </div>
            </ReportSection>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function BitacoraStep({ b, latest }) {
  const tone = b.flag === "warn" ? "amber" : "wing";
  const bg = b.flag === "warn" ? "rgba(212,165,116,0.08)" : "white";
  return (
    <div className="fade-up" style={{
      borderLeft: `2px solid var(--${b.flag === "warn" ? "andes-orange" : "paramo-green"})`,
      paddingLeft: 12, marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>⏱ {b.t}</span>
        <span style={{ fontSize: 13 }}>{b.icon}</span>
        {!latest && <span style={{ color: "var(--paramo-green)", fontSize: 11 }}>✓</span>}
      </div>
      <div style={{
        fontSize: 12.5, color: "var(--condor-wing)", lineHeight: 1.45,
        background: bg, padding: "6px 10px", borderRadius: 8,
        borderLeft: latest ? "2px solid var(--andes-orange)" : "none",
      }}>
        {b.text}
        {latest && <span style={{ marginLeft: 2, animation: "typewriter-blink 0.8s infinite" }}>▍</span>}
        {b.detail && (
          <ul style={{ margin: "6px 0 0 0", padding: "0 0 0 16px", fontSize: 11, color: "var(--ink-soft)" }}>
            {b.detail.map((d, i) => <li key={i}>→ {d}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReportSection({ n, title, sub, tone = "wing", children }) {
  const accent = { red: "var(--guayaba-red)", orange: "var(--andes-orange)", wing: "var(--condor-wing)" }[tone];
  return (
    <div className="card fade-up" style={{
      padding: 22, marginBottom: 16, position: "relative",
      borderTop: `3px solid ${accent}`,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".2em" }}>
          §{String(n).padStart(2, "0")}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 500 }}>{title}</h3>
        {sub && <div style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: "auto" }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function EvidenceCard({ title, type, findings, hero }) {
  return (
    <div style={{
      border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
      background: hero ? "linear-gradient(180deg, rgba(197,51,58,0.04), white)" : "white",
    }}>
      <div style={{
        height: 80,
        background: hero
          ? "repeating-linear-gradient(135deg, rgba(197,51,58,0.10) 0 8px, rgba(197,51,58,0.04) 8px 16px)"
          : "repeating-linear-gradient(135deg, rgba(26,58,82,0.06) 0 8px, rgba(26,58,82,0.02) 8px 16px)",
        display: "grid", placeItems: "center", position: "relative",
      }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".1em" }}>
          [ {hero ? "FOTO DAÑO" : title.toUpperCase()} ]
        </div>
        {hero && (
          <div style={{ position: "absolute", top: 8, right: 8, fontSize: 9, color: "var(--guayaba-red)", fontWeight: 700, letterSpacing: ".15em" }}>
            ⚠ INCONSISTENCIA
          </div>
        )}
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-mute)", marginBottom: 8 }}>{type}</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
          {findings.map(([flag, text], i) => (
            <li key={i} style={{ fontSize: 11, display: "flex", gap: 4, lineHeight: 1.4, color: flag === "⚠️" ? "var(--guayaba-red)" : "var(--paramo-green)" }}>
              <span>{flag}</span><span style={{ color: "var(--condor-wing)" }}>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SimBar({ value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: 140 }}>
      <div style={{ flex: 1, height: 5, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value * 100}%`, height: "100%", background: "var(--guayaba-red)" }}/>
      </div>
      <span className="mono" style={{ fontSize: 10, color: "var(--guayaba-red)", fontWeight: 600 }}>{value.toFixed(2)}</span>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--marfil-paper)", borderRadius: 8 }}>
      <div className="serif tabular" style={{ fontSize: 22, fontWeight: 600, color: tone === "red" ? "var(--guayaba-red)" : "var(--condor-wing)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 4, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function Timeline({ items }) {
  return (
    <div style={{ position: "relative", paddingLeft: 16 }}>
      <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 2, background: "var(--line)" }}/>
      {items.map(([d, t, sub, tone], i) => {
        const c = { red: "var(--guayaba-red)", amber: "var(--andes-ocher)", wing: "var(--mountain-blue)" }[tone];
        return (
          <div key={i} style={{ position: "relative", paddingLeft: 18, paddingBottom: 12 }}>
            <div style={{ position: "absolute", left: -2, top: 4, width: 12, height: 12, borderRadius: "50%", background: c, border: "2px solid var(--marfil)" }}/>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{d}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{t}</div>
            <div style={{ fontSize: 11, color: tone === "red" ? "var(--guayaba-red)" : "var(--ink-mute)" }}>{sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function MiniTejido() {
  return (
    <svg viewBox="0 0 240 180" style={{ width: "100%", height: 180 }}>
      <defs>
        <pattern id="andean-rhombi" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="rgba(26,58,82,0.08)" />
        </pattern>
      </defs>
      <rect width="240" height="180" fill="var(--marfil-paper)" />
      <rect width="240" height="180" fill="url(#andean-rhombi)" />
      {/* center provider */}
      <g>
        {/* edges */}
        {[[60,30],[60,90],[60,150],[200,40],[200,100],[200,160]].map(([x,y],i) => (
          <line key={i} x1={120} y1={90} x2={x} y2={y} stroke="var(--guayaba-red)" strokeWidth="1.2" opacity="0.5" />
        ))}
        {/* nodes */}
        <circle cx="120" cy="90" r="14" fill="var(--guayaba-red)" />
        <text x="120" y="94" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">PRV</text>
        {[[60,30],[60,90],[60,150],[200,40],[200,100],[200,160]].map(([x,y],i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="6" fill="var(--mountain-blue)" />
          </g>
        ))}
      </g>
      <text x="120" y="172" textAnchor="middle" fontSize="9" fill="var(--ink-mute)">cluster · 5 asegurados → 1 proveedor</text>
    </svg>
  );
}

