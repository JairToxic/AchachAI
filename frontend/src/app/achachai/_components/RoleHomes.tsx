'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Condor, VueloDelCondor, CondorMini } from './Condor';
import { TriangleAlert } from './TriangleAlert';
import { CondorLogo } from './CondorLogo';

const useRH = useState;

/* ============================================================
   ROLE HOMES — each role gets a distinct landing screen showing
   its superpower. Cóndor always present, but the layout differs.
   ============================================================ */

export function RoleHome({ role, onInvestigate, onGoChat }) {
  const map = {
    antifraude:  AntifraudeHome,
    siniestros:  SiniestrosHome,
    jefatura:    JefaturaHome,
    riesgos:     RiesgosHome,
    auditoria:   AuditoriaHome,
    tecnologia:  TecnologiaHome,
    gerencia:    GerenciaHome,
  };
  const Cmp = map[role] || AntifraudeHome;
  return <Cmp onInvestigate={onInvestigate} onGoChat={onGoChat}/>;
}

/* ---------- shared frame ---------- */
function RoleFrame({ icon, title, super: superPower, accent, children, extra }) {
  return (
    <div style={{ height: "100%", overflow: "auto", background: "transparent" }}>
      <div style={{
        padding: "26px 36px 22px",
        borderBottom: "1px solid rgba(148, 163, 184, 0.10)",
        background: `linear-gradient(180deg, rgba(6, 182, 212, 0.05), transparent 80%)`,
        display: "flex", alignItems: "center", gap: 18,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, rgba(11, 58, 117, 0.30), rgba(6, 182, 212, 0.18))`,
          border: `1px solid rgba(6, 182, 212, 0.35)`,
          boxShadow: `0 0 18px rgba(6, 182, 212, 0.18)`,
          display: "grid", placeItems: "center", fontSize: 22,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".22em", color: "#67E8F9", fontWeight: 600, textTransform: "uppercase" }}>
            Superpoder · {superPower}
          </div>
          <h2 style={{ fontSize: 26, marginTop: 4, color: "var(--text-primary)", fontFamily: "var(--display)", fontWeight: 700, letterSpacing: "-0.03em" }}>{title}</h2>
        </div>
        {extra}
      </div>
      <div style={{ padding: 32 }}>{children}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone = "wing", big }) {
  const palette = {
    red:    { color: "#F87171", glow: "0 0 18px rgba(239,68,68,0.35)" },
    green:  { color: "#34D399", glow: "0 0 18px rgba(34,197,94,0.30)" },
    orange: { color: "#22D3EE", glow: "0 0 18px rgba(6,182,212,0.32)" },
    blue:   { color: "#60A5FA", glow: "0 0 18px rgba(21,101,192,0.32)" },
    wing:   { color: "#F8FAFC", glow: "0 0 14px rgba(148,163,184,0.18)" },
  };
  const p = palette[tone] || palette.wing;
  return (
    <div className="card" style={{ padding: big ? "18px 20px" : "14px 16px" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div className="display tabular" style={{
        fontSize: big ? 44 : 28,
        fontWeight: 700,
        color: p.color,
        lineHeight: 1,
        marginTop: 8,
        letterSpacing: "-0.02em",
        textShadow: p.glow,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14, marginTop: 4 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, flex: 1, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{children}</h3>
      {action}
    </div>
  );
}

/* ============================================================
   1. ANTIFRAUDE — focused on a single critical case
   ============================================================ */
function AntifraudeHome({ onInvestigate }) {
  return (
    <RoleFrame
      icon="🕵️"
      title="Caso del día"
      super="Investigación profunda caso por caso"
      accent="#C5333A"
      extra={<button className="btn" onClick={() => onInvestigate("SIN-100029")}>🦅 Investigar profundo</button>}
    >
      {/* Critical case spotlight */}
      <div className="card" style={{
        padding: 32, marginBottom: 26,
        border: "1px solid rgba(6, 182, 212, 0.28)",
        boxShadow: "0 24px 80px rgba(0, 0, 0, 0.40), 0 0 40px rgba(6, 182, 212, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        background: "radial-gradient(circle at 85% 20%, rgba(6, 182, 212, 0.14), transparent 32%), linear-gradient(135deg, rgba(7, 20, 38, 0.96), rgba(2, 6, 23, 0.98))",
        display: "grid", gridTemplateColumns: "240px 1fr", gap: 32, alignItems: "center",
      }}>
        <VueloDelCondor score={87} variant="lg"/>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 10.5, color: "#67E8F9", fontWeight: 600, letterSpacing: ".12em" }}>SIN-100029</span>
            <span style={{
              fontSize: 9.5, padding: "2px 8px", borderRadius: 999,
              background: "rgba(239, 68, 68, 0.10)", color: "#FCA5A5",
              border: "1px solid rgba(239, 68, 68, 0.30)",
              fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase",
            }}>Crítico</span>
          </div>
          <h2 style={{ fontSize: 26, color: "var(--text-primary)", fontFamily: "var(--display)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            Auto 2019 · colisión lateral · Quito Norte
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.65, maxWidth: 620 }}>
            Patrón clásico de fraude organizado: proveedor recurrente, factura anticipada y narrativa que no
            coincide con la foto del daño. <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>3 evidencias documentales</strong> activas.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {[
              ["RF-01 PTxRB", true],
              ["RF-04 ProvNuevo", false],
              ["factura adulterada", false],
              ["narrativa incongruente", false],
            ].map(([t, critical]) =>
              <span key={t as string} className={`chip${critical ? ' red' : ''}`} style={{ fontSize: 11 }}>{t}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button className="btn warm" onClick={() => onInvestigate("SIN-100029")}>Abrir investigación →</button>
            <button className="btn ghost">Ver evidencia</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Patrón detectado */}
        <div className="card" style={{ padding: 28 }}>
          <SectionTitle action={
            <span style={{
              fontSize: 9.5, padding: "3px 9px", borderRadius: 999,
              background: "rgba(6, 182, 212, 0.10)", color: "#67E8F9",
              border: "1px solid rgba(6, 182, 212, 0.28)",
              fontWeight: 600, letterSpacing: ".10em", textTransform: "uppercase",
            }}>Insight IA</span>
          }>
            Patrón detectado esta semana
          </SectionTitle>
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "18px 20px",
            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(34, 197, 94, 0.05))",
            border: "1px solid rgba(6, 182, 212, 0.20)",
            borderRadius: 16, marginBottom: 18,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}>
            <div style={{
              flexShrink: 0,
              display: "grid", placeItems: "center",
              width: 38, height: 38, borderRadius: 12,
              background: "rgba(6, 182, 212, 0.10)",
              border: "1px solid rgba(6, 182, 212, 0.30)",
            }}>
              <TriangleAlert size={20} color="#22D3EE" glow={false}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                <span className="mono" style={{ color: "#67E8F9", letterSpacing: ".06em" }}>PRV-NEW0019</span> aparece en 8 casos del último mes
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 3 }}>
                5 asegurados distintos · $156K USD vinculados · 3 narrativas casi idénticas
              </div>
            </div>
            <button className="btn ghost" style={{ fontSize: 11 }}>Ver red →</button>
          </div>
          <SectionTitle>Casos vinculados</SectionTitle>
          {[
            ["SIN-100029", 87, "$8.450", "Quito N."],
            ["SIN-100456", 82, "$11.200", "Cumbayá"],
            ["SIN-100789", 78, "$6.900", "Guayaquil C."],
            ["SIN-101023", 76, "$9.340", "Tumbaco"],
          ].map(([id, score, m, c]) => (
            <div key={id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 14px",
              borderRadius: 12, marginBottom: 6,
              border: "1px solid rgba(148, 163, 184, 0.10)",
              background: "rgba(11, 30, 51, 0.35)",
              transition: "border-color .15s ease, background .15s ease",
            }}>
              <VueloDelCondor score={score} variant="sm"/>
              <div style={{ flex: 1 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: ".04em" }}>{id}</span>
                <span style={{ marginLeft: 10, fontSize: 11, color: "var(--text-muted)" }}>{c}</span>
              </div>
              <span className="tabular mono" style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{m}</span>
              <button className="chip outline" style={{ fontSize: 10, cursor: "pointer" }} onClick={() => onInvestigate(id)}>investigar →</button>
            </div>
          ))}
        </div>

        {/* Cóndor narration */}
        <div className="card" style={{
          padding: 28,
          background: "radial-gradient(circle at 90% 0%, rgba(6, 182, 212, 0.08), transparent 35%), linear-gradient(180deg, rgba(7, 20, 38, 0.86), rgba(2, 6, 23, 0.92))",
          border: "1px solid rgba(6, 182, 212, 0.24)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        }}>
          <SectionTitle>El cóndor te narra</SectionTitle>
          <div style={{ display: "flex", gap: 14, marginBottom: 16, alignItems: "center" }}>
            <div style={{
              filter: "drop-shadow(0 0 10px rgba(6, 182, 212, 0.40))",
              flexShrink: 0,
              display: "inline-flex",
            }}>
              <CondorLogo size={40}/>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-primary)" }}>
              "Este caso me llamó la atención por <strong style={{ color: "#22D3EE", fontWeight: 600 }}>3 razones</strong>:"
            </div>
          </div>
          <ol style={{ margin: "0 0 0 18px", padding: 0, fontSize: 12.5, lineHeight: 1.8, color: "var(--text-secondary)" }}>
            <li>El proveedor <span className="mono" style={{ color: "#67E8F9", letterSpacing: ".04em" }}>PRV-NEW0019</span> está en observación.</li>
            <li>La factura tiene fecha <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>14 días antes</strong> del siniestro.</li>
            <li>Es la <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>4ta vez</strong> que este asegurado reclama en 6 meses.</li>
          </ol>
          <div style={{
            marginTop: 20, padding: "16px 18px",
            background: "rgba(2, 6, 23, 0.55)",
            border: "1px solid rgba(34, 197, 94, 0.28)",
            borderRadius: 14,
            fontSize: 12.5,
            color: "var(--text-primary)",
            lineHeight: 1.55,
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <span style={{
              flexShrink: 0,
              display: "grid", placeItems: "center",
              width: 26, height: 26, borderRadius: 8,
              background: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              color: "#34D399", fontSize: 14, fontWeight: 700,
            }}>✓</span>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#34D399", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 4 }}>
                Sugerencia
              </div>
              Investigar al proveedor primero. No te digo qué hacer, pero por ahí empezaría yo.
            </div>
          </div>
        </div>
      </div>
    </RoleFrame>
  );
}

/* ============================================================
   2. SINIESTROS — my day, queue priority
   ============================================================ */
function SiniestrosHome({ onInvestigate }) {
  const today = [
    { id: "SIN-100029", score: 87, due: "10:30", monto: "$8.450", state: "pendiente" },
    { id: "SIN-100456", score: 82, due: "11:15", monto: "$11.200", state: "pendiente" },
    { id: "SIN-101205", score: 58, due: "12:00", monto: "$3.100", state: "en revisión" },
    { id: "SIN-101620", score: 22, due: "14:00", monto: "$1.240", state: "pendiente" },
    { id: "SIN-101725", score: 18, due: "15:30", monto: "$890",  state: "pendiente" },
  ];
  return (
    <RoleFrame
      icon="📋"
      title="Mi día, priorizado por el cóndor"
      super="Mi día priorizado en orden"
      accent="#E87A4F"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Mi cola" value="23" sub="5 prioritarios hoy" tone="wing"/>
        <KpiCard label="Resueltos esta semana" value="34" sub="↑ 12% vs semana pasada" tone="green"/>
        <KpiCard label="Tiempo medio" value="18m" sub="objetivo: 20m" tone="wing"/>
        <KpiCard label="Aprobación con cóndor" value="92%" sub="aceptás sus sugerencias" tone="orange"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle action={<span className="chip blue">5 sugeridos por orden óptimo</span>}>
            Hoy te recomiendo resolver en este orden
          </SectionTitle>
          <div style={{ display: "grid", gap: 6 }}>
            {today.map((c, i) => (
              <div key={c.id} style={{
                display: "grid", gridTemplateColumns: "32px 1fr auto auto auto auto",
                gap: 10, alignItems: "center", padding: "10px 12px",
                background: "rgba(11, 30, 51, 0.55)", borderRadius: 12,
                border: "1px solid rgba(148, 163, 184, 0.12)",
              }}>
                <div className="display" style={{ fontSize: 22, color: "#22D3EE", fontWeight: 700, textShadow: "0 0 10px rgba(6, 182, 212, 0.45)" }}>{i+1}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: "#67E8F9" }}>{c.id}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>vencimiento {c.due} · {c.state}</div>
                </div>
                <VueloDelCondor score={c.score} variant="sm"/>
                <span className="tabular mono" style={{ fontSize: 12 }}>{c.monto}</span>
                <button className="chip outline" style={{ fontSize: 10, cursor: "pointer" }}>✓ resolver</button>
                <button className="chip outline" style={{ fontSize: 10, cursor: "pointer" }} onClick={() => onInvestigate(c.id)}>investigar</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Avance del día</SectionTitle>
          <ProgressRing value={42} label="42%" sub="de tu cola de hoy"/>
          <div style={{ marginTop: 18 }}>
            <SectionTitle>Decisiones tomadas hoy</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
              <div style={{ padding: 10, background: "rgba(34, 197, 94, 0.12)", borderRadius: 8 }}>
                <div className="serif tabular" style={{ fontSize: 22, color: "var(--paramo-green)" }}>8</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>Aprobados</div>
              </div>
              <div style={{ padding: 10, background: "rgba(245, 158, 11, 0.18)", borderRadius: 8 }}>
                <div className="serif tabular" style={{ fontSize: 22, color: "#8B5E2B" }}>3</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>En espera</div>
              </div>
              <div style={{ padding: 10, background: "rgba(239, 68, 68, 0.12)", borderRadius: 8 }}>
                <div className="serif tabular" style={{ fontSize: 22, color: "var(--guayaba-red)" }}>1</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>Escalado</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleFrame>
  );
}

function ProgressRing({ value, label, sub }) {
  const r = 50, c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={120} height={120} style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 0 6px rgba(6, 182, 212, 0.40))" }}>
        <defs>
          <linearGradient id="progress-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1565C0"/>
            <stop offset="100%" stopColor="#06B6D4"/>
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(148, 163, 184, 0.14)" strokeWidth="8"/>
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#progress-ring-grad)" strokeWidth="8"
          strokeDasharray={`${(value/100)*c} ${c}`} strokeLinecap="round"/>
      </svg>
      <div>
        <div className="display tabular" style={{ fontSize: 36, fontWeight: 700, color: "#22D3EE", letterSpacing: "-0.02em", textShadow: "0 0 18px rgba(6, 182, 212, 0.45)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>
      </div>
    </div>
  );
}

/* ============================================================
   3. JEFATURA — Map of Ecuador with hot cities + team KPIs
   ============================================================ */
function JefaturaHome() {
  return (
    <RoleFrame
      icon="📊"
      title="Centro de operaciones"
      super="Centro de operaciones"
      accent="#2C5F8D"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Casos abiertos" value="412" sub="↑ 18 desde ayer" tone="wing"/>
        <KpiCard label="Sucursales activas" value="7" sub="Quito · GYE · CUE · MAN · LOJ · AMB · ESM" tone="wing"/>
        <KpiCard label="Productividad equipo" value="94%" sub="vs objetivo 90%" tone="green"/>
        <KpiCard label="SLA cumplido" value="87%" sub="caída en Guayaquil" tone="orange"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden", minHeight: 460 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            <SectionTitle action={<span className="chip blue">🦅 cóndores volando sobre 7 ciudades</span>}>
              Mapa de calor · Ecuador
            </SectionTitle>
          </div>
          <EcuadorMap/>
        </div>

        <div>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <SectionTitle>Productividad analistas · esta semana</SectionTitle>
            {[
              { name: "María Yánez",  city: "Quito",      done: 34, target: 30 },
              { name: "Diego Cevallos", city: "Quito",    done: 28, target: 30 },
              { name: "Ana Toral",    city: "Cumbayá",    done: 26, target: 25 },
              { name: "Luis Vélez",   city: "Guayaquil",  done: 18, target: 30 },
              { name: "Sofía Borja",  city: "Cuenca",     done: 22, target: 20 },
            ].map(a => (
              <div key={a.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
                  <span>{a.name} <span style={{ color: "var(--ink-mute)" }}>· {a.city}</span></span>
                  <span className="tabular mono">{a.done}/{a.target}</span>
                </div>
                <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, (a.done/a.target)*100)}%`, height: "100%",
                    background: a.done >= a.target ? "var(--paramo-green)" : a.done < a.target * 0.7 ? "var(--guayaba-red)" : "var(--andes-ocher)",
                  }}/>
                </div>
              </div>
            ))}
          </div>
          <div className="card" style={{
            padding: 16,
            background: "rgba(6, 182, 212, 0.08)",
            border: "1px solid rgba(6, 182, 212, 0.30)",
            borderLeft: "3px solid #06B6D4",
          }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Condor size={24} tone="orange" mood="alert"/>
              <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                <strong style={{ color: "#22D3EE" }}>Luis Vélez</strong> está al 60% del objetivo en Guayaquil. ¿Reasigno 8 casos al equipo de Quito?
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button className="btn warm" style={{ fontSize: 10.5, padding: "5px 12px" }}>Sí, reasignar</button>
                  <button className="btn ghost" style={{ fontSize: 10.5, padding: "5px 12px" }}>Más tarde</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleFrame>
  );
}

function EcuadorMap() {
  // Simplified Ecuador silhouette with hot cities
  const cities = [
    { name: "Quito",     x: 165, y: 130, hot: "red",   n: 142 },
    { name: "Cumbayá",   x: 178, y: 138, hot: "red",   n: 48 },
    { name: "Ambato",    x: 162, y: 175, hot: "amber", n: 32 },
    { name: "Guayaquil", x: 105, y: 220, hot: "amber", n: 88 },
    { name: "Cuenca",    x: 138, y: 260, hot: "green", n: 41 },
    { name: "Manta",     x: 70,  y: 195, hot: "green", n: 26 },
    { name: "Loja",      x: 132, y: 320, hot: "green", n: 18 },
    { name: "Esmeraldas", x: 105, y: 75, hot: "green", n: 17 },
  ];
  const cMap = { red: "#C5333A", amber: "#D4A574", green: "#4A7C59" };
  return (
    <svg viewBox="0 0 280 380" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <radialGradient id="city-glow-red">
          <stop offset="0%" stopColor="rgba(239, 68, 68, 0.45)"/>
          <stop offset="100%" stopColor="rgba(239, 68, 68, 0)"/>
        </radialGradient>
        <radialGradient id="city-glow-amber">
          <stop offset="0%" stopColor="rgba(245, 158, 11, 0.40)"/>
          <stop offset="100%" stopColor="rgba(245, 158, 11, 0)"/>
        </radialGradient>
      </defs>
      {/* Ecuador silhouette — simplified */}
      <path d="M 60 50
               L 130 40 L 180 55 L 230 60 L 250 90
               L 245 130 L 235 170 L 220 210 L 210 250 L 195 290
               L 175 340 L 140 365 L 110 360 L 80 340
               L 55 300 L 45 250 L 50 200 L 60 160
               L 55 120 L 50 85 Z"
            fill="rgba(11, 30, 51, 0.7)" stroke="rgba(6, 182, 212, 0.45)" strokeWidth="1" opacity="0.95"/>
      {/* Equator line */}
      <line x1="40" y1="130" x2="260" y2="130" stroke="#06B6D4" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7"/>
      <text x="248" y="126" fontSize="8" fill="#22D3EE" textAnchor="end">ecuador</text>
      {/* Andes spine */}
      <path d="M 155 50 L 160 90 L 165 130 L 162 170 L 158 220 L 152 270 L 145 320"
            fill="none" stroke="rgba(148, 163, 184, 0.5)" strokeWidth="1.5" opacity="0.6" strokeDasharray="2 4"/>

      {cities.map(c => (
        <g key={c.name}>
          <circle cx={c.x} cy={c.y} r="22" fill={`url(#city-glow-${c.hot === "green" ? "amber" : c.hot})`}/>
          <circle cx={c.x} cy={c.y} r="5" fill={cMap[c.hot]} stroke="white" strokeWidth="1.5"/>
          {c.hot === "red" && (
            <circle cx={c.x} cy={c.y} r="5" fill="none" stroke={cMap[c.hot]} strokeWidth="1"
              style={{ transformOrigin: `${c.x}px ${c.y}px`, animation: "sonar-out 1.6s ease-out infinite" }}/>
          )}
          <text x={c.x + 8} y={c.y - 6} fontSize="9" fontWeight="600" fill="var(--condor-wing)">{c.name}</text>
          <text x={c.x + 8} y={c.y + 5} fontSize="8" fill="var(--ink-mute)">{c.n} casos</text>
        </g>
      ))}

      {/* condors flying over hot cities */}
      <g transform="translate(150, 90)" style={{ animation: "condor-soar 5s ease-in-out infinite" }}>
        <Condor size={22} tone="wing" mood="still"/>
      </g>
      <g transform="translate(90, 195)" style={{ animation: "condor-soar 6s ease-in-out infinite 1s" }}>
        <Condor size={18} tone="wing" mood="still"/>
      </g>
    </svg>
  );
}

/* ============================================================
   4. RIESGOS — Provider exposure heatmap
   ============================================================ */
function RiesgosHome() {
  const providers = [
    { id: "PRV-NEW0019", name: "Auto Servicio Andes",  exp: 156, cases: 32, level: "red" },
    { id: "PRV-0007",    name: "Taller Cumbayá",       exp: 132, cases: 28, level: "red" },
    { id: "PRV-0042",    name: "Clínica San Rafael",   exp: 98,  cases: 21, level: "red" },
    { id: "PRV-0019",    name: "Multipartes Guayas",   exp: 76,  cases: 18, level: "amber" },
    { id: "PRV-0103",    name: "Repuestos del Valle",  exp: 54,  cases: 14, level: "amber" },
    { id: "PRV-0088",    name: "Auto Quito",           exp: 42,  cases: 12, level: "amber" },
    { id: "PRV-0044",    name: "Manta Motors",         exp: 31,  cases: 9,  level: "green" },
    { id: "PRV-0011",    name: "Carrocerías Norte",    exp: 24,  cases: 7,  level: "green" },
    { id: "PRV-0033",    name: "Loja Auto",            exp: 18,  cases: 5,  level: "green" },
    { id: "PRV-0061",    name: "Servitec Cuenca",      exp: 14,  cases: 4,  level: "green" },
    { id: "PRV-0029",    name: "Ambato Express",       exp: 11,  cases: 3,  level: "green" },
    { id: "PRV-0077",    name: "Esmeraldas Repair",    exp: 9,   cases: 3,  level: "green" },
  ];
  const max = 160;
  const cMap = { red: "#EF4444", amber: "#F59E0B", green: "#22C55E" };
  return (
    <RoleFrame
      icon="⚠️"
      title="Mapa de exposición consolidada"
      super="Mapa de exposición consolidada"
      accent="#D4A574"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Exposición total" value="$865K" sub="USD vinculado a sospecha" tone="red"/>
        <KpiCard label="Proveedores activos" value="198" sub="16 en lista restrictiva" tone="wing"/>
        <KpiCard label="Concentración top 5" value="68%" sub="del total expuesto" tone="orange"/>
        <KpiCard label="Reducción potencial" value="-$486K" sub="si bloqueás top 5" tone="green"/>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <SectionTitle action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="chip outline" style={{ fontSize: 11 }}>por proveedor</button>
            <button className="chip blue" style={{ fontSize: 11, fontWeight: 600 }}>por proveedor ✓</button>
            <button className="chip outline" style={{ fontSize: 11 }}>por cobertura</button>
            <button className="chip outline" style={{ fontSize: 11 }}>por segmento</button>
          </div>
        }>
          Heatmap de exposición · top 12 proveedores
        </SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {providers.map(p => {
            const ratio = p.exp / max;
            const alpha = Math.max(0.10, ratio * 0.35);
            return (
              <div key={p.id} style={{
                padding: "14px 16px", borderRadius: 14,
                background: `linear-gradient(135deg, ${cMap[p.level]}${Math.floor(alpha * 255).toString(16).padStart(2,"0")}, rgba(7, 20, 38, 0.6))`,
                border: `1px solid ${cMap[p.level]}55`,
                boxShadow: `0 0 ${12 + ratio * 24}px ${cMap[p.level]}33`,
                color: "var(--text-primary)",
                minHeight: 110,
              }}>
                <div className="mono" style={{ fontSize: 10.5, color: cMap[p.level], opacity: 0.95, fontWeight: 600 }}>{p.id}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, lineHeight: 1.3, color: "var(--text-primary)" }}>{p.name}</div>
                <div className="display tabular" style={{ fontSize: 24, fontWeight: 700, marginTop: 10, color: cMap[p.level], letterSpacing: "-0.02em", textShadow: `0 0 12px ${cMap[p.level]}55` }}>${p.exp}K</div>
                <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 2 }}>{p.cases} casos vinculados</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* What-if simulator */}
      <div className="card" style={{ padding: 18 }}>
        <SectionTitle>Simulador what-if</SectionTitle>
        <WhatIfSimulator/>
      </div>
    </RoleFrame>
  );
}

function WhatIfSimulator() {
  const [n, setN] = useRH(5);
  const recovered = (n * 97.2).toFixed(0);
  const cases = n * 17;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 24, alignItems: "center" }}>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Si bloqueamos los top <strong style={{ color: "#22D3EE", fontSize: 14 }}>{n}</strong> proveedores sospechosos:
        </label>
        <input
          type="range" min={1} max={20} value={n} onChange={e => setN(+e.target.value)}
          style={{ width: "100%", marginTop: 12, accentColor: "#06B6D4" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
          <span>1</span><span>10</span><span>20</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <KpiCard label="Recuperación est." value={`$${recovered}K`} tone="green"/>
        <KpiCard label="Casos afectados" value={cases} tone="wing"/>
        <KpiCard label="Falsos positivos" value={`${(n * 1.4).toFixed(1)}%`} tone="orange"/>
      </div>
    </div>
  );
}

/* ============================================================
   5. AUDITORÍA — Forensic timeline + signed actions
   ============================================================ */
function AuditoriaHome() {
  return (
    <RoleFrame
      icon="🔍"
      title="Cadena de evidencia forense"
      super="Cadena de evidencia legal"
      accent="#4A7C59"
      extra={<button className="btn">⬇ Exportar PDF compliance</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Casos auditables" value="247" sub="firmados digitalmente" tone="wing"/>
        <KpiCard label="Cambios esta semana" value="63" sub="trazados con autor + diff" tone="wing"/>
        <KpiCard label="Cumplimiento SBS" value="100%" sub="política Q1 2026" tone="green"/>
        <KpiCard label="Tiempo retención" value="7 años" sub="política regulatoria" tone="wing"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Timeline forense · SIN-100029</SectionTitle>
          <ForensicTimeline/>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Diferencias detectadas · usuario "María Yánez"</SectionTitle>
          {[
            { time: "09:42", what: "Reclasificó SIN-100456 de rojo → amarillo", before: "score 82 · rojo", after: "score 82 · amarillo (override)", reason: "Documentación adicional recibida" },
            { time: "10:18", what: "Aprobó pago SIN-101205", before: "pendiente", after: "aprobado · $3.100", reason: "Factura validada con proveedor" },
            { time: "11:05", what: "Marcó PRV-0042 para investigación", before: "estado normal", after: "lista de observación", reason: "5 casos concentrados último mes" },
          ].map((d, i) => (
            <div key={i} style={{ padding: "12px 14px", marginBottom: 8, background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.18)", borderRadius: 12, borderLeft: "3px solid #22C55E" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{d.what}</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>⏱ {d.time}</span>
              </div>
              <div style={{ display: "flex", gap: 6, fontSize: 10.5, marginBottom: 4 }}>
                <span className="chip" style={{ padding: "1px 6px", fontSize: 9.5 }}>antes: {d.before}</span>
                <span style={{ color: "var(--ink-mute)" }}>→</span>
                <span className="chip green" style={{ padding: "1px 6px", fontSize: 9.5 }}>{d.after}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-mute)", fontStyle: "italic" }}>Justificación: "{d.reason}"</div>
            </div>
          ))}
        </div>
      </div>
    </RoleFrame>
  );
}

function ForensicTimeline() {
  const events = [
    { t: "2024-08-01 09:14", who: "sistema", what: "Caso ingresado vía API", hash: "0x4a2f…b81e" },
    { t: "2024-08-01 09:14", who: "azure-ml", what: "Score inicial calculado: 87/100", hash: "0xc1d9…04a3" },
    { t: "2024-08-01 09:15", who: "azure-di", what: "Factura procesada · 3 anomalías", hash: "0x88e2…7f1a" },
    { t: "2024-08-01 09:15", who: "gpt-4o-v", what: "Foto analizada · inconsistencia detectada", hash: "0x12bc…5e90" },
    { t: "2024-08-01 14:22", who: "maría.yánez", what: "Investigación profunda iniciada", hash: "0xee31…2a44" },
    { t: "2024-08-01 14:38", who: "maría.yánez", what: "Pago bloqueado · justificado", hash: "0x9d7c…11bd" },
    { t: "2024-08-02 08:00", who: "sistema", what: "Reporte firmado y enviado a comité", hash: "0x55ff…ab12" },
  ];
  return (
    <div style={{ position: "relative", paddingLeft: 18 }}>
      <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "var(--paramo-green)" }}/>
      {events.map((e, i) => (
        <div key={i} style={{ position: "relative", paddingLeft: 16, paddingBottom: 12 }}>
          <div style={{ position: "absolute", left: -2, top: 4, width: 12, height: 12, borderRadius: "50%", background: "#0B1E33", border: "2px solid #22C55E", boxShadow: "0 0 6px rgba(34, 197, 94, 0.55)" }}/>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{e.t} · {e.who}</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>{e.what}</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--paramo-green)" }}>✓ {e.hash}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   6. TECNOLOGÍA — Grafana-style monitoring
   ============================================================ */
function TecnologiaHome() {
  return (
    <RoleFrame
      icon="🛠️"
      title="Salud del sistema en tiempo real"
      super="Salud del sistema en tiempo real"
      accent="#1F4A73"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Uptime 30d" value="99.97%" sub="SLA: 99.5%" tone="green"/>
        <KpiCard label="Latencia p95" value="142ms" sub="Azure ML endpoint" tone="green"/>
        <KpiCard label="Tokens / día" value="2.4M" sub="$3.20 USD" tone="wing"/>
        <KpiCard label="Errores 5xx 24h" value="3" sub="↓ 60% vs ayer" tone="green"/>
        <KpiCard label="Modelo activo" value="v4.2.1" sub="desde 12-may" tone="wing"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle action={<span className="chip blue mono">últimas 24h</span>}>
            Latencia por endpoint
          </SectionTitle>
          <LatencyChart/>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Endpoints monitoreados</SectionTitle>
          {[
            { name: "POST /api/score", lat: 142, status: "ok",   p95: 198 },
            { name: "POST /api/agent/chat", lat: 1420, status: "ok",   p95: 2100 },
            { name: "POST /api/documents/analyze", lat: 3200, status: "warn", p95: 5400 },
            { name: "GET  /api/cases", lat: 38, status: "ok",   p95: 64 },
            { name: "POST /api/reports/generate", lat: 8400, status: "ok",   p95: 12000 },
          ].map(e => (
            <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.status === "ok" ? "var(--paramo-green)" : "var(--andes-ocher)" }}/>
              <span className="mono" style={{ fontSize: 11, flex: 1 }}>{e.name}</span>
              <span className="tabular mono" style={{ fontSize: 11, color: e.status === "ok" ? "var(--paramo-green)" : "var(--andes-ocher)" }}>{e.lat}ms</span>
              <span className="tabular mono" style={{ fontSize: 10, color: "var(--ink-mute)", width: 60, textAlign: "right" }}>p95 {e.p95}ms</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Métricas del modelo · v3 vs v4</SectionTitle>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Métrica", "v3", "v4", "Δ"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 4px", fontSize: 10, color: "var(--ink-mute)", textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["AUC",       "0.92", "0.96", "+0.04"],
                ["Recall",    "0.71", "0.79", "+0.08"],
                ["F1",        "0.68", "0.73", "+0.05"],
                ["Precisión", "0.66", "0.69", "+0.03"],
              ].map(r => (
                <tr key={r[0]} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 4px" }}>{r[0]}</td>
                  <td className="mono tabular" style={{ padding: "10px 4px", color: "var(--ink-mute)" }}>{r[1]}</td>
                  <td className="mono tabular" style={{ padding: "10px 4px", fontWeight: 600 }}>{r[2]}</td>
                  <td className="mono tabular" style={{ padding: "10px 4px", color: "var(--paramo-green)" }}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Logs · últimas 4h</SectionTitle>
          <div className="mono" style={{
            fontSize: 10.5, lineHeight: 1.7,
            background: "rgba(2, 6, 23, 0.85)",
            color: "#CBD5E1",
            padding: 14, borderRadius: 12, height: 200, overflow: "auto",
            border: "1px solid rgba(6, 182, 212, 0.18)",
            boxShadow: "inset 0 0 24px rgba(6, 182, 212, 0.06)",
          }}>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:42:18 score computed sin=100029 v=4.2.1 lat=128ms</div>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:42:19 agent.tool=ranking_proveedores tokens=412</div>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:42:21 di.invoice extracted=13 fields ok=true</div>
            <div style={{ color: "#FCD34D" }}>[WARN] 09:43:02 vision.gpt4o slow=3.2s expected=&lt;2s</div>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:43:14 embeddings.search hits=3 sim&gt;=0.94</div>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:43:30 report.signed hash=0x55ff…ab12</div>
            <div style={{ color: "#FCA5A5" }}>[ERROR] 09:44:08 docs.upload size&gt;25MB rejected user=luis.velez</div>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:44:22 agent.tool=top_riesgo tokens=287</div>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:44:35 cache.hit ratio=0.78 last_1h</div>
            <div style={{ color: "#86EFAC" }}>[INFO] 09:45:01 model.feedback received id=fb_4421</div>
          </div>
        </div>
      </div>
    </RoleFrame>
  );
}

function LatencyChart() {
  // sparkline-style multi-line
  const points = [
    { name: "score", color: "#4A7C59", values: [120,130,118,142,135,128,140,145,132,128,135,142] },
    { name: "agent", color: "#2C5F8D", values: [1300,1420,1380,1500,1620,1420,1380,1500,1700,1450,1390,1420] },
    { name: "docs",  color: "#D4A574", values: [2800,3100,3400,3200,3600,3100,2900,3300,3500,3200,3400,3200] },
  ];
  const W = 600, H = 180, padL = 30, padB = 22, padT = 10, padR = 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180 }}>
      {[0,0.25,0.5,0.75,1].map((v,i) => (
        <line key={i} x1={padL} y1={padT + (H-padT-padB)*v} x2={W-padR} y2={padT + (H-padT-padB)*v} stroke="var(--line)"/>
      ))}
      {points.map(line => {
        const max = Math.max(...line.values);
        const path = line.values.map((v, i) => {
          const x = padL + ((W - padL - padR) * i) / (line.values.length - 1);
          const y = padT + (H - padT - padB) * (1 - v / max);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(" ");
        return <path key={line.name} d={path} fill="none" stroke={line.color} strokeWidth="2"/>;
      })}
      {/* legend */}
      <g transform={`translate(${padL}, ${H - 10})`}>
        {points.map((l, i) => (
          <g key={l.name} transform={`translate(${i * 90}, 0)`}>
            <rect width="10" height="3" y="-4" fill={l.color}/>
            <text x="14" y="0" fontSize="10" fill="var(--ink-mute)">{l.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ============================================================
   7. GERENCIA — Executive KPIs + what-if
   ============================================================ */
function GerenciaHome() {
  return (
    <RoleFrame
      icon="💼"
      title="Pulso ejecutivo de cartera"
      super="Pulso ejecutivo cartera"
      accent="#1A3A52"
      extra={<button className="btn">📤 Compartir con el board</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
        <KpiCard label="Recuperación mayo" value="$486K" sub="↑ 38% vs abril" tone="green" big/>
        <KpiCard label="ROI proyectado" value="1.634%" sub="payback 0.7 meses" tone="green" big/>
        <KpiCard label="Casos vigilados 24/7" value="25.460" sub="por el cóndor" tone="wing" big/>
        <KpiCard label="Precisión (AUC)" value="0.96" sub="top 5% industria" tone="wing" big/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Recuperación mensual</SectionTitle>
          <RevenueChart/>
        </div>
        <div className="card" style={{
          padding: 18,
          background: "linear-gradient(180deg, rgba(6, 182, 212, 0.08), rgba(7, 20, 38, 0.78) 60%)",
          border: "1px solid rgba(6, 182, 212, 0.30)",
          boxShadow: "0 0 28px rgba(6, 182, 212, 0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>
          <SectionTitle>Top 3 logros para el board</SectionTitle>
          {[
            ["1", "$486K recuperados en mayo", "vs $352K abril (+38%)"],
            ["2", "Cluster PRV-NEW0019 desmantelado", "8 casos · $156K bloqueados"],
            ["3", "Tiempo de detección bajó a 1.4s", "antes: 18 min por caso"],
          ].map(([n, t, sub]) => (
            <div key={n} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}>
              <div className="display" style={{ fontSize: 28, color: "#22D3EE", fontWeight: 700, lineHeight: 1, textShadow: "0 0 12px rgba(6, 182, 212, 0.45)", letterSpacing: "-0.02em" }}>{n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
          <button className="btn warm" style={{ marginTop: 16, width: "100%" }}>📄 Generar resumen ejecutivo</button>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <SectionTitle>Simulador what-if · threshold de detección</SectionTitle>
        <ThresholdSimulator/>
      </div>
    </RoleFrame>
  );
}

function RevenueChart() {
  const data = [
    { m: "Ene", real: 142, manual: 88 },
    { m: "Feb", real: 198, manual: 92 },
    { m: "Mar", real: 264, manual: 95 },
    { m: "Abr", real: 352, manual: 102 },
    { m: "May", real: 486, manual: 108 },
  ];
  const max = 500;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 200, padding: "10px 0" }}>
        {data.map(d => (
          <div key={d.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, flex: 1, width: "100%", justifyContent: "center" }}>
              <div style={{ width: 18, height: `${(d.manual/max)*100}%`, background: "rgba(148, 163, 184, 0.28)", borderRadius: "4px 4px 0 0" }}/>
              <div style={{
                width: 18, height: `${(d.real/max)*100}%`,
                background: "linear-gradient(180deg, #06B6D4, #1565C0)",
                borderRadius: "4px 4px 0 0", position: "relative",
                boxShadow: "0 0 12px rgba(6, 182, 212, 0.45)",
              }}>
                <div className="tabular mono" style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#22D3EE", fontWeight: 700, textShadow: "0 0 6px rgba(6, 182, 212, 0.45)" }}>${d.real}K</div>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{d.m}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "linear-gradient(180deg, #06B6D4, #1565C0)", marginRight: 6, verticalAlign: "middle", borderRadius: 2 }}/> con AchachAI</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(148, 163, 184, 0.28)", marginRight: 6, verticalAlign: "middle", borderRadius: 2 }}/> detección manual</span>
      </div>
    </div>
  );
}

function ThresholdSimulator() {
  const [t, setT] = useRH(70);
  const detection = Math.min(95, 50 + (t - 30) * 0.6).toFixed(0);
  const fp = Math.max(3, 28 - t * 0.25).toFixed(1);
  const recovered = Math.round(486 * (detection / 80));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 24, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>Threshold de alerta</div>
        <div className="display tabular" style={{ fontSize: 52, fontWeight: 700, color: "#22D3EE", lineHeight: 1, marginTop: 6, textShadow: "0 0 22px rgba(6, 182, 212, 0.55)", letterSpacing: "-0.03em" }}>{t}</div>
        <input
          type="range" min={30} max={95} value={t} onChange={e => setT(+e.target.value)}
          style={{ width: "100%", marginTop: 14, accentColor: "#06B6D4" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}>
          <span>30 (sensible)</span><span>95 (conservador)</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <KpiCard label="Detección" value={`${detection}%`} sub="de fraudes reales" tone="green"/>
        <KpiCard label="Falsos positivos" value={`${fp}%`} sub="casos buenos alertados" tone="orange"/>
        <KpiCard label="Recuperación est." value={`$${recovered}K`} sub="proyección mensual" tone="wing"/>
      </div>
    </div>
  );
}

