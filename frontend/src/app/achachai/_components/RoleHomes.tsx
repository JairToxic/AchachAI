'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Condor, VueloDelCondor, CondorMini } from './Condor';
import { EcuadorHeatMap } from './EcuadorHeatMap';
import { CondorLogo } from './CondorLogo';
import { RiskScore } from './RiskScore';
import { MetricCard } from './MetricCard';
import { Chip } from './Chip';
import { CondorNarration } from './CondorNarration';
import {
  FaUserShield,
  FaShieldAlt,
  FaFileAlt,
  FaUserNurse,
  FaSearch,
  FaExclamationTriangle,
  FaClipboardCheck,
  FaChartLine,
  FaBolt,
  FaMagic,
  FaBrain,
  FaDatabase,
  FaEye,
  FaBriefcase,
  FaUserTie,
  FaBalanceScale,
  FaUsers,
  FaCog,
  FaArrowRight,
  FaExternalLinkAlt,
  FaNetworkWired,
  FaCheckCircle,
  FaInbox,
  FaDownload,
  FaUpload,
  FaShareAlt,
} from 'react-icons/fa';

const useRH = useState;
const useRHE = useEffect;

const API =
  (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_API_URL) ||
  'http://localhost:8000';

function fmtUSD(n: number | null | undefined) {
  if (n == null || isNaN(n as any)) return '—';
  return '$' + Math.round(n as number).toLocaleString('en-US');
}

/** Envía feedback rápido al backend. Devuelve promesa pero no bloquea UI. */
function fbQuick(id_siniestro: string, decision: string, score_modelo: number, nivel_modelo: string) {
  fetch(`${API}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_siniestro,
      decision,
      justificacion: `Decisión rápida desde Mi vista`,
      analista_id: 'ana.yanez',
      score_modelo,
      nivel_modelo,
    }),
  })
    .then(r => r.json())
    .then(d => {
      if (d?.ok) console.log(`feedback registrado para ${id_siniestro}: ${decision} (total: ${d.total_feedbacks})`);
    })
    .catch(e => console.warn('feedback failed', e));
}

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
  // icon puede ser un componente FA (React.ComponentType) o un emoji legacy (string)
  const IconCmp = typeof icon === 'function' ? icon : null;
  return (
    <div style={{ height: "100%", overflow: "auto", background: "var(--bg-main)" }}>
      <div style={{
        padding: "22px 32px 20px", borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-card)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 12,
          background: `${accent}1A`, color: accent,
          display: "grid", placeItems: "center", fontSize: 18,
          flexShrink: 0,
        }}>
          {IconCmp ? <IconCmp size={20} /> : icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".16em", color: accent, fontWeight: 700, textTransform: "uppercase" }}>
            Superpoder · {superPower}
          </div>
          <h2 className="display" style={{ fontSize: 22, marginTop: 4, color: "var(--text-primary)" }}>{title}</h2>
        </div>
        {extra}
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone = "wing", big }) {
  const c = { red: "var(--guayaba-red)", green: "var(--paramo-green)", orange: "var(--andes-orange)", blue: "var(--mountain-blue)", wing: "var(--condor-wing)" }[tone];
  return (
    <div className="card" style={{ padding: big ? "18px 20px" : "14px 16px" }}>
      <div style={{ fontSize: 10, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase" }}>{label}</div>
      <div className="serif tabular" style={{ fontSize: big ? 44 : 28, fontWeight: 500, color: c, lineHeight: 1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12, marginTop: 4 }}>
      <h3 style={{ fontSize: 16, fontWeight: 500, flex: 1 }}>{children}</h3>
      {action}
    </div>
  );
}

function Stat({ label, value, tone = "wing" }) {
  const c = {
    red: "var(--guayaba-red)",
    green: "var(--paramo-green)",
    orange: "var(--andes-orange)",
    blue: "var(--mountain-blue)",
    wing: "var(--condor-wing)",
  }[tone];
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--marfil-paper)",
      borderRadius: 8,
      border: "1px solid var(--line)",
    }}>
      <div style={{ fontSize: 9.5, color: "var(--ink-mute)", letterSpacing: ".1em", textTransform: "uppercase" }}>{label}</div>
      <div className="serif tabular" style={{ fontSize: 22, fontWeight: 500, color: c, lineHeight: 1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* ============================================================
   1. ANTIFRAUDE — focused on a single critical case (datos reales)
   ============================================================ */
function AntifraudeHome({ onInvestigate }) {
  const [topCases, setTopCases] = useRH<any[]>([]);
  const [detail, setDetail] = useRH<any>(null);
  const [topProv, setTopProv] = useRH<any>(null);
  const [kpis, setKpis] = useRH<any>(null);
  const [fbStats, setFbStats] = useRH<any>(null);
  const [anomalias, setAnomalias] = useRH<any>(null);
  const [alertas, setAlertas] = useRH<any>(null);
  const [loading, setLoading] = useRH(true);
  const [err, setErr] = useRH<string | null>(null);

  useRHE(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);

    async function load() {
      try {
        // Disparamos todo en paralelo (los lentos no bloquean lo visible)
        const [trResp, pvResp, kResp, fbResp, anResp, alResp] = await Promise.all([
          fetch(`${API}/top-riesgo?limit=10`, { cache: 'no-store' }),
          fetch(`${API}/proveedores/ranking?top_n=1`, { cache: 'no-store' }),
          fetch(`${API}/kpis`, { cache: 'no-store' }).catch(() => null),
          fetch(`${API}/feedback/stats`, { cache: 'no-store' }).catch(() => null),
          fetch(`${API}/anomalias-novedosas?limit=5`, { cache: 'no-store' }).catch(() => null),
          fetch(`${API}/prevencion/alertas-tempranas?ventana_dias=30`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (!trResp.ok) throw new Error(`top-riesgo HTTP ${trResp.status}`);
        const tr = await trResp.json();
        const top = tr.top || [];
        if (cancelled) return;
        setTopCases(top);

        if (top.length > 0) {
          const dResp = await fetch(`${API}/casos/${encodeURIComponent(top[0].id_siniestro)}`, { cache: 'no-store' });
          if (dResp.ok) {
            const d = await dResp.json();
            if (!cancelled) setDetail(d);
          }
        }

        if (pvResp.ok) {
          const pv = await pvResp.json();
          if (!cancelled) setTopProv((pv.top && pv.top[0]) || null);
        }
        if (kResp && kResp.ok) {
          const k = await kResp.json();
          if (!cancelled) setKpis(k);
        }
        if (fbResp && fbResp.ok) {
          const f = await fbResp.json();
          if (!cancelled) setFbStats(f);
        }
        if (anResp && anResp.ok) {
          const an = await anResp.json();
          if (!cancelled) setAnomalias(an);
        }
        if (alResp && alResp.ok) {
          const al = await alResp.json();
          if (!cancelled) setAlertas(al);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const top = topCases[0];
  const topId = top?.id_siniestro;
  const score = top?.score ?? 0;
  const nivel = top?.nivel || 'VERDE';
  const veh = detail?.vehiculo
    ? `${detail.vehiculo.marca || ''} ${detail.vehiculo.modelo || ''} ${detail.vehiculo.anio || ''}`.trim()
    : '—';
  const ciudad = detail?.siniestro?.ciudad_evento || top?.ciudad || '—';
  const cob = (detail?.siniestro?.cobertura || top?.cobertura || '—').toLowerCase();
  const reglas = (detail?.reglas_criticas || []) as any[];
  const senales = (detail?.senales_activadas || []) as any[];

  // Casos vinculados al mismo proveedor (real)
  const provId = detail?.siniestro?.id_proveedor;
  const vinculados = provId
    ? topCases.filter((c: any) => c.id_proveedor === provId).slice(0, 5)
    : topCases.slice(1, 6);

  const accent = '#EF4444';
  const nivelTone =
    nivel === 'ROJO' ? 'var(--danger)' : nivel === 'AMARILLO' ? 'var(--warning)' : 'var(--success)';

  // Narration items para CondorNarration
  const narrationItems: any[] = [
    ...reglas.slice(0, 3).map((r: any) => ({
      title: <><strong>{r.codigo}</strong> · {r.nombre}</>,
      detail: r.evidencia,
      tone: 'danger',
    })),
    ...senales.slice(0, Math.max(0, 3 - reglas.length)).map((s: any) => ({
      title: <><strong>S{s.id}</strong> · {s.nombre} (+{s.puntos} pts)</>,
      detail: s.evidencia,
      tone: 'warning',
    })),
  ];
  if (narrationItems.length === 0) {
    narrationItems.push({
      title: `Score ${score}/100 · nivel ${nivel}`,
      detail: 'Sin alertas binarias, pero el modelo lo prioriza.',
      tone: 'info',
    });
  }

  const suggestionTone =
    nivel === 'ROJO' ? 'danger' : nivel === 'AMARILLO' ? 'warning' : 'primary';
  const suggestionText =
    nivel === 'ROJO'
      ? 'revisar documentación, bloquear pago pendiente y escalar a la unidad antifraude.'
      : nivel === 'AMARILLO'
      ? 'retener el pago y solicitar documentación complementaria antes de aprobar.'
      : 'continuar el flujo normal, pero mantener este caso bajo monitoreo.';

  return (
    <RoleFrame
      icon={FaUserShield}
      title="Caso del día"
      super="Investigación profunda caso por caso"
      accent={accent}
      extra={
        <button
          className="btn"
          disabled={!topId}
          onClick={() => topId && onInvestigate(topId)}
        >
          <FaSearch size={13} /> Investigar profundo
        </button>
      }
    >
      {loading && (
        <div className="card" style={{ padding: 28, marginBottom: 18, textAlign: 'center' }}>
          <CondorLogo size={56} />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            El cóndor está sobrevolando los 15K siniestros para elegirte el caso del día…
          </div>
        </div>
      )}

      {err && !loading && (
        <div
          className="card"
          style={{ padding: 18, marginBottom: 18, borderLeft: '3px solid var(--danger)' }}
        >
          <div style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaExclamationTriangle size={14} /> No pude consultar al backend: {err}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
            Verifica que <span className="mono">uvicorn</span> esté corriendo en {API}.
          </div>
        </div>
      )}

      {!loading && top && (
        <>
          {/* ============================================================
              CASO DEL DIA — card blanca, score circular a la izquierda
              ============================================================ */}
          <div
            className="card"
            style={{
              padding: 22,
              marginBottom: 18,
              borderTop: `3px solid ${nivelTone}`,
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 220px) 1fr',
              gap: 26,
              alignItems: 'center',
            }}
          >
            <RiskScore score={score} variant="lg" />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10.5,
                  letterSpacing: '0.16em',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                <FaSearch size={11} /> Investigación profunda
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600 }}>
                {topId}
              </div>
              <h2
                className="display"
                style={{ fontSize: 22, marginTop: 4, color: 'var(--text-primary)' }}
              >
                {veh !== '—' ? veh : 'Vehículo'} · {cob} · {ciudad}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  marginTop: 8,
                  lineHeight: 1.55,
                }}
              >
                {detail?.explicacion ||
                  `Score ${score}/100 · nivel ${nivel}. Caso prioritario según el motor de reglas + modelo.`}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {reglas.slice(0, 3).map((r: any) => (
                  <Chip key={r.codigo} tone="red" icon={FaExclamationTriangle}>
                    {r.codigo} · {r.nombre.split(' ').slice(0, 3).join(' ')}
                  </Chip>
                ))}
                {senales.slice(0, 3).map((s: any) => (
                  <Chip key={s.id} tone="amber">
                    S{s.id} +{s.puntos}
                  </Chip>
                ))}
                {reglas.length === 0 && senales.length === 0 && (
                  <Chip tone="green" icon={FaCheckCircle}>
                    sin alertas activas
                  </Chip>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => onInvestigate(topId)}>
                  Abrir investigación <FaArrowRight size={11} />
                </button>
                <button
                  className="btn ghost"
                  onClick={() =>
                    window.open(`${API}/casos/${encodeURIComponent(topId)}`, '_blank')
                  }
                >
                  <FaExternalLinkAlt size={11} /> Ver evidencia (JSON)
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {/* Patrón detectado — provider + casos vinculados */}
            <div className="card" style={{ padding: 18, gridColumn: 'span 2', minWidth: 0 }}>
              <SectionTitle>Patrón detectado esta semana</SectionTitle>
              {topProv ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    background: 'var(--bg-card-soft)',
                    borderRadius: 10,
                    marginBottom: 14,
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--danger-soft)',
                      color: 'var(--danger)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FaNetworkWired size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      <span className="mono">{topProv.id_proveedor}</span> · {topProv.nombre || '—'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Concentra {topProv.n_siniestros} siniestros · {topProv.ciudad || '—'} ·
                      promedio {fmtUSD(topProv.monto_promedio)}
                    </div>
                  </div>
                  {topProv.lista_restrictiva && (
                    <Chip tone="red" icon={FaExclamationTriangle}>lista restrictiva</Chip>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Sin ranking de proveedores disponible.
                </div>
              )}

              <SectionTitle>
                {provId
                  ? <>Casos del proveedor <span className="mono">{provId}</span> en el top de riesgo</>
                  : <>Otros casos de alto riesgo</>}
              </SectionTitle>
              {vinculados.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  No hay otros casos del mismo proveedor en el top-riesgo actual.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {vinculados.map((c: any) => (
                  <div
                    key={c.id_siniestro}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-card-soft)',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <RiskScore score={c.score} variant="sm" withCondor={false} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.id_siniestro}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {c.ciudad || '—'}
                      </div>
                    </div>
                    <span className="tabular mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                      {fmtUSD(c.monto_reclamado_usd)}
                    </span>
                    <button
                      className="btn ghost"
                      onClick={() => onInvestigate(c.id_siniestro)}
                      style={{ padding: '5px 10px', fontSize: 11 }}
                    >
                      <FaSearch size={10} /> Investigar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cóndor narration */}
            <CondorNarration
              intro={
                reglas.length + senales.length > 0
                  ? <>Este caso llamó mi atención por <strong>{reglas.length + senales.length} señal(es)</strong>:</>
                  : 'Es el caso más prioritario hoy según el modelo XGBoost, aunque sin reglas críticas disparadas.'
              }
              items={narrationItems}
              suggestion={suggestionText}
              suggestionTone={suggestionTone as any}
            />
          </div>

          {/* ============================================================
              MÉTRICAS DE CARTERA · estilo Konrix
              ============================================================ */}
          {kpis && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
                marginTop: 20,
              }}
            >
              <MetricCard
                icon={FaDatabase}
                tone="primary"
                label="Cartera total"
                value={(kpis.totales?.siniestros || 0).toLocaleString('en-US')}
                sub="siniestros vigilados 24/7"
              />
              <MetricCard
                icon={FaExclamationTriangle}
                tone="danger"
                label="Alertas históricas"
                value={(kpis.totales?.fraudes_simulados || 0).toLocaleString('en-US')}
                sub={`${((kpis.totales?.tasa_fraude_simulada || 0) * 100).toFixed(1)}% de la cartera`}
              />
              <MetricCard
                icon={FaFileAlt}
                tone="warning"
                label="Documentos inconsistentes"
                value={(kpis.totales?.documentos_inconsistentes || 0).toLocaleString('en-US')}
                sub={`de ${(kpis.totales?.documentos_totales || 0).toLocaleString('en-US')} analizados`}
              />
              <MetricCard
                icon={FaUserShield}
                tone="accent"
                label="Proveedores en lista restrictiva"
                value={kpis.totales?.proveedores_lista_restrictiva || 0}
                sub="bloqueados preventivamente"
              />
            </div>
          )}

          {/* ============================================================
              SEGUNDA FILA · aprendizaje + alertas + anomalías
              ============================================================ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginTop: 16,
            }}
          >
            {/* CARD 1: aprendizaje */}
            <div className="card" style={{ padding: 18, borderTop: '3px solid var(--accent)' }}>
              <SectionTitle>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <FaBrain size={14} style={{ color: 'var(--accent)' }} />
                  Mi aprendizaje del cóndor
                </span>
              </SectionTitle>
              {!fbStats || fbStats.total === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Todavía no registraste decisiones. Investigá un caso y al final presioná{' '}
                  <strong>Aprobar / Retener / Bloquear / Escalar</strong> para empezar a entrenar
                  al cóndor con tu criterio.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Stat label="Decisiones acumuladas" value={fbStats.total} />
                    <Stat
                      label="Esta semana"
                      value={fbStats.ultimas_7d}
                      tone={fbStats.ultimas_7d > 0 ? 'orange' : 'wing'}
                    />
                  </div>
                  {fbStats.alineacion_con_modelo_pct != null && (
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: 'var(--text-secondary)',
                          marginBottom: 4,
                        }}
                      >
                        Alineación con el nivel sugerido del modelo
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: 'var(--bg-subtle)',
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${fbStats.alineacion_con_modelo_pct}%`,
                            height: '100%',
                            background:
                              fbStats.alineacion_con_modelo_pct >= 80
                                ? 'var(--success)'
                                : fbStats.alineacion_con_modelo_pct >= 60
                                ? 'var(--warning)'
                                : 'var(--danger)',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-primary)',
                          marginTop: 4,
                          fontWeight: 600,
                        }}
                      >
                        {fbStats.alineacion_con_modelo_pct}%
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* CARD 2: alertas tempranas */}
            <div className="card" style={{ padding: 18, borderTop: '3px solid var(--success)' }}>
              <SectionTitle
                action={
                  alertas?.n_alertas > 0 && (
                    <Chip tone="red" size="sm">{alertas.n_alertas} activas</Chip>
                  )
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <FaShieldAlt size={14} style={{ color: 'var(--success)' }} />
                  Prevención · clusters formándose
                </span>
              </SectionTitle>
              {!alertas || alertas.n_alertas === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <FaCheckCircle size={12} style={{ color: 'var(--success)' }} />
                  La cartera luce estable en la última ventana de{' '}
                  {alertas?.ventana_efectiva_dias || 30}d.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                      marginBottom: 10,
                    }}
                  >
                    Detecté <strong>{alertas.n_alertas} patrones</strong> formándose · USD{' '}
                    <strong>{Math.round((alertas.monto_total_en_riesgo_usd || 0) / 1000)}K</strong>{' '}
                    prevenibles si actuás ahora.
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {alertas.alertas?.slice(0, 3).map((a: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--bg-card-soft)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 6,
                          fontSize: 11,
                          borderLeft: `3px solid ${
                            a.severidad === 'alta' ? 'var(--danger)' : 'var(--warning)'
                          }`,
                        }}
                      >
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {a.entidad}
                        </span>
                        <span style={{ marginLeft: 6, color: 'var(--text-secondary)' }}>
                          · {a.n_casos_recientes} casos · $
                          {(a.monto_en_riesgo_usd / 1000).toFixed(0)}K
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* CARD 3: patrones inusuales */}
            <div className="card" style={{ padding: 18, borderTop: '3px solid var(--primary)' }}>
              <SectionTitle
                action={
                  anomalias?.novedosos > 0 && (
                    <Chip tone="blue" size="sm">{anomalias.novedosos} nuevos</Chip>
                  )
                }
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <FaMagic size={14} style={{ color: 'var(--primary)' }} />
                  Patrones inusuales hoy
                </span>
              </SectionTitle>
              {!anomalias || !anomalias.items?.length ? (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  IsolationForest todavía no produjo resultados.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                      marginBottom: 10,
                    }}
                  >
                    Detecté <strong>{anomalias.total}</strong> casos estadísticamente raros,{' '}
                    <strong>{anomalias.novedosos}</strong> sin alerta histórica previa.
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {anomalias.items.slice(0, 3).map((it: any) => (
                      <div
                        key={it.id_siniestro}
                        onClick={() => onInvestigate && onInvestigate(it.id_siniestro)}
                        style={{
                          padding: '8px 10px',
                          background: 'var(--bg-card-soft)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 6,
                          fontSize: 11,
                          cursor: 'pointer',
                          borderLeft: `3px solid ${
                            it.novedoso ? 'var(--danger)' : 'var(--success)'
                          }`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {it.id_siniestro}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          · score {it.anomaly_score}
                        </span>
                        {it.novedoso && (
                          <Chip tone="red" size="sm" style={{ marginLeft: 'auto', fontSize: 9 }}>
                            nuevo
                          </Chip>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </RoleFrame>
  );
}

/* ============================================================
   2. SINIESTROS — my day, queue priority (datos reales)
   ============================================================ */

/* Hash determinista identico al backend (_analista_para_siniestro) para
   filtrar el top-riesgo por analista actual sin nuevo endpoint. */
function analistaParaId(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0;
  return h % n;
}

const ANALISTAS_FRONT = [
  { id: 'ana.yanez',      nombre: 'María Yánez' },
  { id: 'diego.cevallos', nombre: 'Diego Cevallos' },
  { id: 'ana.toral',      nombre: 'Ana Toral' },
  { id: 'luis.velez',     nombre: 'Luis Vélez' },
  { id: 'sofia.borja',    nombre: 'Sofía Borja' },
];
const ANALISTA_ACTUAL_IDX = 0; // María Yánez = índice 0

function SiniestrosHome({ onInvestigate }) {
  const [topMine, setTopMine] = useRH<any[]>([]);
  const [carga, setCarga] = useRH<any>(null);
  const [fb, setFb] = useRH<any>(null);
  const [loading, setLoading] = useRH(true);

  useRHE(() => {
    Promise.all([
      fetch(`${API}/top-riesgo?limit=30`).then(r => r.json()).catch(() => ({ top: [] })),
      fetch(`${API}/analistas/carga`).then(r => r.json()).catch(() => null),
      fetch(`${API}/feedback/stats`).then(r => r.json()).catch(() => null),
    ]).then(([tr, c, f]) => {
      const mine = (tr.top || []).filter((cs: any) =>
        analistaParaId(cs.id_siniestro, ANALISTAS_FRONT.length) === ANALISTA_ACTUAL_IDX
      );
      setTopMine(mine);
      setCarga(c);
      setFb(f);
      setLoading(false);
    });
  }, []);

  const today = topMine.slice(0, 5);
  const miCargaObj = carga?.analistas?.[ANALISTA_ACTUAL_IDX];
  const miCarga = miCargaObj?.n_casos || 0;
  const miPend = miCargaObj?.n_pendientes_estim || 0;
  const totalFb = fb?.total || 0;
  const align = fb?.alineacion_con_modelo_pct;

  return (
    <RoleFrame
      icon={FaUserTie}
      title="Mi día, priorizado por el cóndor"
      super="Mi día priorizado en orden"
      accent="#E87A4F"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Mi cola" value={miCarga ? miCarga.toLocaleString('en-US') : '…'} sub={`${miPend} estimados pendientes`} tone="wing"/>
        <KpiCard label="Feedback semana" value={fb?.ultimas_7d ?? '…'} sub={`${totalFb} decisiones acumuladas`} tone="green"/>
        <KpiCard label="Mi top 5 hoy" value={String(today.length)} sub="filtrado por hash de id_siniestro" tone="wing"/>
        <KpiCard label="Alineación con cóndor" value={align != null ? `${align}%` : '—'} sub={align != null ? 'tus decisiones vs nivel sugerido' : 'sin feedback aún'} tone="orange"/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle action={<span className="chip blue">{today.length} casos asignados a María Yánez</span>}>
            Hoy te recomiendo resolver en este orden
          </SectionTitle>
          {loading && <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Sobrevolando el dataset…</div>}
          {!loading && today.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>No te tocó ningún caso del top de riesgo hoy. Toca al cóndor agéntico si querés ver toda la cartera.</div>}
          <div style={{ display: "grid", gap: 6 }}>
            {today.map((c: any, i: number) => (
              <div key={c.id_siniestro} style={{
                display: "grid", gridTemplateColumns: "32px 1fr auto auto auto auto",
                gap: 10, alignItems: "center", padding: "10px 12px",
                background: "var(--marfil-paper)", borderRadius: 10, border: "1px solid var(--line)",
              }}>
                <div className="serif" style={{ fontSize: 22, color: "var(--andes-orange)", fontWeight: 600 }}>{i+1}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--mountain-blue)" }}>{c.id_siniestro}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{c.ciudad || '—'} · {c.cobertura} · nivel {c.nivel}</div>
                </div>
                <VueloDelCondor score={c.score} variant="sm"/>
                <span className="tabular mono" style={{ fontSize: 12 }}>${(c.monto_reclamado_usd||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                <button className="btn ghost sm" onClick={() => fbQuick(c.id_siniestro, 'aprobar', c.score, c.nivel)}><FaCheckCircle size={10} /> Resolver</button>
                <button className="btn ghost sm" onClick={() => onInvestigate(c.id_siniestro)}><FaSearch size={10} /> Investigar</button>
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
              <div style={{ padding: 10, background: "rgba(74,124,89,0.10)", borderRadius: 8 }}>
                <div className="serif tabular" style={{ fontSize: 22, color: "var(--paramo-green)" }}>8</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>Aprobados</div>
              </div>
              <div style={{ padding: 10, background: "rgba(212,165,116,0.18)", borderRadius: 8 }}>
                <div className="serif tabular" style={{ fontSize: 22, color: "#8B5E2B" }}>3</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>En espera</div>
              </div>
              <div style={{ padding: 10, background: "rgba(197,51,58,0.10)", borderRadius: 8 }}>
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
      <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="8"/>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--andes-orange)" strokeWidth="8"
          strokeDasharray={`${(value/100)*c} ${c}`} strokeLinecap="round"/>
      </svg>
      <div>
        <div className="serif tabular" style={{ fontSize: 32, fontWeight: 500, color: "var(--andes-orange)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{sub}</div>
      </div>
    </div>
  );
}

/* ============================================================
   3. JEFATURA — Map of Ecuador con hot cities + team KPIs (datos reales)
   ============================================================ */
function JefaturaHome() {
  const [sucursales, setSucursales] = useRH<any[]>([]);
  const [analistas, setAnalistas] = useRH<any[]>([]);
  const [kpis, setKpis] = useRH<any>(null);
  const [loading, setLoading] = useRH(true);

  useRHE(() => {
    Promise.all([
      fetch(`${API}/sucursales/ranking?top_n=20`).then(r => r.json()).catch(() => ({ top: [] })),
      fetch(`${API}/analistas/carga`).then(r => r.json()).catch(() => ({ analistas: [] })),
      fetch(`${API}/kpis`).then(r => r.json()).catch(() => null),
    ]).then(([s, a, k]) => {
      setSucursales(s?.top || []);
      setAnalistas(a?.analistas || []);
      setKpis(k);
      setLoading(false);
    });
  }, []);

  const totalSin = kpis?.totales?.siniestros || 0;
  const totalSuc = sucursales.length;
  const peorSucursal = [...sucursales].sort((a, b) => (b.tasa_fraude_sim || 0) - (a.tasa_fraude_sim || 0))[0];
  const masCargada = [...analistas].sort((a, b) => b.n_casos - a.n_casos)[0];

  return (
    <RoleFrame
      icon={FaBriefcase}
      title="Centro de operaciones"
      super="Centro de operaciones"
      accent="#2C5F8D"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Casos en cartera" value={totalSin ? totalSin.toLocaleString('en-US') : '…'} sub={loading ? 'cargando…' : 'evaluados por el modelo'} tone="wing"/>
        <KpiCard label="Sucursales activas" value={totalSuc ? String(totalSuc) : '…'} sub={sucursales.slice(0, 4).map((s: any) => s.sucursal).join(' · ') || '—'} tone="wing"/>
        <KpiCard label="Sucursal con mayor tasa de alertas" value={peorSucursal?.sucursal || '—'} sub={peorSucursal ? `${(peorSucursal.tasa_fraude_sim*100).toFixed(1)}% marcadas históricamente · ${peorSucursal.n_siniestros} casos` : '—'} tone="red"/>
        <KpiCard label="Analista más cargado" value={masCargada?.nombre || '—'} sub={masCargada ? `${masCargada.n_casos.toLocaleString('en-US')} casos` : '—'} tone="orange"/>
      </div>

      {/* Mapa de calor de Ecuador real */}
      {sucursales.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <EcuadorHeatMap
            data={sucursales.map((s: any) => ({
              ciudad: s.sucursal,
              n_siniestros: s.n_siniestros,
              tasa_fraude: s.tasa_fraude_sim,
              monto_promedio: s.monto_promedio,
            }))}
            metric="tasa"
            title="Mapa de calor por sucursal · tasa de alertas históricas"
            height={420}
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        <div className="card" style={{ padding: 18, minHeight: 460 }}>
          <SectionTitle action={<span className="chip blue">{sucursales.length} sucursales en cartera</span>}>
            Sucursales · ranking por # siniestros (real)
          </SectionTitle>
          {loading && <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Sobrevolando dataset…</div>}
          <div style={{ display: 'grid', gap: 4, maxHeight: 410, overflow: 'auto' }}>
            {sucursales.map((s: any) => {
              const tasa = s.tasa_fraude_sim || 0;
              const tone = tasa > 0.08 ? 'red' : tasa > 0.04 ? 'amber' : 'green';
              const tc = tone === 'red' ? 'var(--guayaba-red)' : tone === 'amber' ? 'var(--andes-ocher)' : 'var(--paramo-green)';
              return (
                <div key={s.sucursal} style={{
                  display: 'grid', gridTemplateColumns: '130px 1fr 80px 90px 60px',
                  gap: 10, alignItems: 'center', padding: '7px 12px',
                  background: 'var(--marfil-paper)', borderRadius: 8, fontSize: 11.5,
                  borderLeft: `3px solid ${tc}`,
                }}>
                  <span style={{ fontWeight: 600 }}>{s.sucursal}</span>
                  <div style={{ flex: 1, height: 5, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (s.n_siniestros / Math.max(1, sucursales[0]?.n_siniestros || 1)) * 100)}%`, height: '100%', background: tc }} />
                  </div>
                  <span className="tabular mono" style={{ fontSize: 11 }}>{s.n_siniestros.toLocaleString('en-US')} casos</span>
                  <span className="tabular mono" style={{ fontSize: 11 }}>${(s.monto_promedio || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  <span className={`chip mono ${tone}`} style={{ fontSize: 9.5, justifySelf: 'end' }}>{(tasa*100).toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <SectionTitle>Carga del equipo (asignación por hash)</SectionTitle>
            {analistas.map((a: any) => {
              const peso = a.n_casos / Math.max(1, analistas[0]?.n_casos || 1);
              const c = peso > 0.95 ? 'var(--guayaba-red)' : peso > 0.7 ? 'var(--andes-ocher)' : 'var(--paramo-green)';
              return (
                <div key={a.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
                    <span>{a.nombre} <span style={{ color: "var(--ink-mute)" }}>· {a.sucursal_base}</span></span>
                    <span className="tabular mono">{a.n_casos.toLocaleString('en-US')} casos</span>
                  </div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${peso * 100}%`, height: "100%", background: c }}/>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 2 }}>
                    {a.n_fraudes_sim} alerta(s) histórica(s) · ${(a.monto_total_usd/1000).toFixed(0)}K total
                  </div>
                </div>
              );
            })}
          </div>
          {masCargada && peorSucursal && (
            <div className="card" style={{ padding: 14, background: "rgba(232,122,79,0.08)", borderLeft: "3px solid var(--andes-orange)" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <Condor size={24} tone="orange" mood="alert"/>
                <div style={{ fontSize: 12 }}>
                  <strong>{masCargada.nombre}</strong> tiene {masCargada.n_casos.toLocaleString('en-US')} casos en cola.
                  La sucursal <strong>{peorSucursal.sucursal}</strong> es la de mayor tasa de alertas históricas ({(peorSucursal.tasa_fraude_sim*100).toFixed(1)}%).
                  Considerá reasignar carga al equipo con menos casos.
                </div>
              </div>
            </div>
          )}
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
          <stop offset="0%" stopColor="rgba(197,51,58,0.4)"/>
          <stop offset="100%" stopColor="rgba(197,51,58,0)"/>
        </radialGradient>
        <radialGradient id="city-glow-amber">
          <stop offset="0%" stopColor="rgba(212,165,116,0.4)"/>
          <stop offset="100%" stopColor="rgba(212,165,116,0)"/>
        </radialGradient>
      </defs>
      {/* Ecuador silhouette — simplified */}
      <path d="M 60 50
               L 130 40 L 180 55 L 230 60 L 250 90
               L 245 130 L 235 170 L 220 210 L 210 250 L 195 290
               L 175 340 L 140 365 L 110 360 L 80 340
               L 55 300 L 45 250 L 50 200 L 60 160
               L 55 120 L 50 85 Z"
            fill="var(--marfil-paper)" stroke="var(--condor-wing)" strokeWidth="1" opacity="0.9"/>
      {/* Equator line */}
      <line x1="40" y1="130" x2="260" y2="130" stroke="var(--andes-orange)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6"/>
      <text x="248" y="126" fontSize="8" fill="var(--andes-orange)" textAnchor="end">ecuador</text>
      {/* Andes spine */}
      <path d="M 155 50 L 160 90 L 165 130 L 162 170 L 158 220 L 152 270 L 145 320"
            fill="none" stroke="var(--condor-wing)" strokeWidth="1.5" opacity="0.25" strokeDasharray="2 4"/>

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
   4. RIESGOS — Provider exposure heatmap (datos reales)
   ============================================================ */
function RiesgosHome() {
  const [providers, setProviders] = useRH<any[]>([]);
  const [kpis, setKpis] = useRH<any>(null);
  const [loading, setLoading] = useRH(true);

  useRHE(() => {
    Promise.all([
      fetch(`${API}/proveedores/ranking?top_n=12`).then(r => r.json()).catch(() => ({ top: [] })),
      fetch(`${API}/kpis`).then(r => r.json()).catch(() => null),
    ]).then(([pv, kp]) => {
      const items = (pv?.top || []).map((p: any) => {
        const exp = Math.round((p.monto_promedio || 0) * (p.n_siniestros || 0) / 1000); // miles USD
        return {
          id: p.id_proveedor,
          name: p.nombre || p.id_proveedor,
          exp,
          cases: p.n_siniestros || 0,
          level: p.lista_restrictiva ? 'red' : (p.n_fraudes_simulados || 0) > 5 ? 'red' : (p.n_siniestros || 0) > 20 ? 'amber' : 'green',
          restrictiva: !!p.lista_restrictiva,
        };
      });
      setProviders(items);
      setKpis(kp);
      setLoading(false);
    });
  }, []);

  const max = Math.max(160, ...providers.map(p => p.exp));
  const cMap: Record<string, string> = { red: "#C5333A", amber: "#D4A574", green: "#4A7C59" };
  const totalExp = providers.reduce((a, p) => a + p.exp, 0);
  const top5 = providers.slice(0, 5).reduce((a, p) => a + p.exp, 0);
  const totalSin = kpis?.totales?.siniestros || 0;
  const provRestr = kpis?.totales?.proveedores_lista_restrictiva || 0;
  return (
    <RoleFrame
      icon={FaBalanceScale}
      title="Mapa de exposición consolidada"
      super="Mapa de exposición consolidada"
      accent="#D4A574"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <KpiCard label="Exposición top 12" value={`$${totalExp}K`} sub={loading ? 'cargando…' : 'USD vinculado a top proveedores'} tone="red"/>
        <KpiCard label="Proveedores activos" value={kpis ? String(providers.length) : '…'} sub={`${provRestr} en lista restrictiva`} tone="wing"/>
        <KpiCard label="Concentración top 5" value={totalExp > 0 ? `${Math.round((top5/totalExp)*100)}%` : '—'} sub="del total expuesto top 12" tone="orange"/>
        <KpiCard label="Reducción potencial" value={`-$${top5}K`} sub="si bloqueás top 5" tone="green"/>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <SectionTitle action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="chip outline" style={{ fontSize: 11 }}>por proveedor</button>
            <button className="chip" style={{ fontSize: 11, background: "var(--primary)", color: "white" }}><FaCheckCircle size={10} /> por proveedor</button>
            <button className="chip outline" style={{ fontSize: 11 }}>por cobertura</button>
            <button className="chip outline" style={{ fontSize: 11 }}>por segmento</button>
          </div>
        }>
          Heatmap de exposición · top 12 proveedores
        </SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {providers.map(p => {
            const ratio = p.exp / max;
            return (
              <div key={p.id} style={{
                padding: "12px 14px", borderRadius: 10,
                background: `${cMap[p.level]}${Math.floor(ratio * 100).toString(16).padStart(2,"0")}`,
                border: `1px solid ${cMap[p.level]}55`,
                color: ratio > 0.6 ? "white" : "var(--condor-wing)",
                minHeight: 100,
              }}>
                <div className="mono" style={{ fontSize: 10.5, opacity: 0.85 }}>{p.id}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>{p.name}</div>
                <div className="serif tabular" style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>${p.exp}K</div>
                <div style={{ fontSize: 10.5, opacity: 0.85 }}>{p.cases} casos vinculados</div>
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
        <label style={{ fontSize: 12, color: "var(--ink-mute)" }}>
          Si bloqueamos los top <strong style={{ color: "var(--condor-wing)" }}>{n}</strong> proveedores sospechosos:
        </label>
        <input
          type="range" min={1} max={20} value={n} onChange={e => setN(+e.target.value)}
          style={{ width: "100%", marginTop: 10, accentColor: "var(--andes-orange)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>
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
      icon={FaUserNurse}
      title="Cadena de evidencia forense"
      super="Cadena de evidencia legal"
      accent="#4A7C59"
      extra={<button className="btn"><FaDownload size={12} /> Exportar PDF compliance</button>}
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
            <div key={i} style={{ padding: "10px 12px", marginBottom: 8, background: "var(--marfil-paper)", borderRadius: 10, borderLeft: "3px solid var(--paramo-green)" }}>
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
          <div style={{ position: "absolute", left: -2, top: 4, width: 12, height: 12, borderRadius: "50%", background: "white", border: "2px solid var(--paramo-green)" }}/>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-mute)" }}>{e.t} · {e.who}</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>{e.what}</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--success)", display: 'inline-flex', alignItems: 'center', gap: 4 }}><FaCheckCircle size={9} /> {e.hash}</div>
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
      icon={FaCog}
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
          <div className="mono" style={{ fontSize: 10.5, lineHeight: 1.7, background: "#0F2436", color: "#cfe2f3", padding: 12, borderRadius: 8, height: 200, overflow: "auto" }}>
            <div style={{ color: "#80c080" }}>[INFO] 09:42:18 score computed sin=100029 v=4.2.1 lat=128ms</div>
            <div style={{ color: "#80c080" }}>[INFO] 09:42:19 agent.tool=ranking_proveedores tokens=412</div>
            <div style={{ color: "#80c080" }}>[INFO] 09:42:21 di.invoice extracted=13 fields ok=true</div>
            <div style={{ color: "#e8c068" }}>[WARN] 09:43:02 vision.gpt4o slow=3.2s expected=&lt;2s</div>
            <div style={{ color: "#80c080" }}>[INFO] 09:43:14 embeddings.search hits=3 sim&gt;=0.94</div>
            <div style={{ color: "#80c080" }}>[INFO] 09:43:30 report.signed hash=0x55ff…ab12</div>
            <div style={{ color: "#e07070" }}>[ERROR] 09:44:08 docs.upload size&gt;25MB rejected user=luis.velez</div>
            <div style={{ color: "#80c080" }}>[INFO] 09:44:22 agent.tool=top_riesgo tokens=287</div>
            <div style={{ color: "#80c080" }}>[INFO] 09:44:35 cache.hit ratio=0.78 last_1h</div>
            <div style={{ color: "#80c080" }}>[INFO] 09:45:01 model.feedback received id=fb_4421</div>
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
   7. GERENCIA — Executive KPIs + what-if (datos reales)
   ============================================================ */
function GerenciaHome() {
  const [kpis, setKpis] = useRH<any>(null);
  const [sim, setSim] = useRH<any>(null);

  useRHE(() => {
    Promise.all([
      fetch(`${API}/kpis`).then(r => r.json()).catch(() => null),
      fetch(`${API}/simulacion-ahorro?tasa_deteccion_actual=0.30&tasa_deteccion_achachai=0.70`).then(r => r.json()).catch(() => null),
    ]).then(([k, s]) => { setKpis(k); setSim(s); });
  }, []);

  const totalSin = kpis?.totales?.siniestros || 0;
  const tasaFraude = kpis?.totales?.tasa_fraude_simulada || 0;
  const montoTotal = kpis?.totales?.monto_reclamado_total_usd || 0;
  const montoFraude = kpis?.totales?.monto_reclamado_fraudes_usd || 0;
  const ahorroAnual = sim?.ahorro_anual_estimado_usd || sim?.ahorro_anual_usd || 0;
  const ahorroMes = Math.round(ahorroAnual / 12);
  const roi = sim?.roi_estimado_pct || sim?.roi_pct || null;

  return (
    <RoleFrame
      icon={FaUsers}
      title="Pulso ejecutivo de cartera"
      super="Pulso ejecutivo cartera"
      accent="#1A3A52"
      extra={<button className="btn"><FaShareAlt size={12} /> Compartir con el board</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
        <KpiCard
          label="Ahorro estimado mensual"
          value={ahorroMes ? `$${(ahorroMes/1000).toFixed(1)}K` : '…'}
          sub={ahorroAnual ? `$${(ahorroAnual/1000).toFixed(0)}K anual proyectado` : 'calculando…'}
          tone="green" big
        />
        <KpiCard
          label="ROI proyectado"
          value={roi ? `${Math.round(roi)}%` : '…'}
          sub="vs proceso manual actual"
          tone="green" big
        />
        <KpiCard
          label="Casos vigilados 24/7"
          value={totalSin ? totalSin.toLocaleString('en-US') : '…'}
          sub="por el cóndor"
          tone="wing" big
        />
        <KpiCard
          label="Exposición con alerta histórica"
          value={montoFraude ? `$${(montoFraude/1000).toFixed(0)}K` : '…'}
          sub={`${(tasaFraude*100).toFixed(1)}% de la cartera marcada históricamente`}
          tone="orange" big
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <SectionTitle>Recuperación mensual</SectionTitle>
          <RevenueChart/>
        </div>
        <div className="card" style={{ padding: 18, background: "linear-gradient(180deg, white, var(--marfil-paper))" }}>
          <SectionTitle>Top 3 logros para el board</SectionTitle>
          {[
            ["1", "$486K recuperados en mayo", "vs $352K abril (+38%)"],
            ["2", "Cluster PRV-NEW0019 desmantelado", "8 casos · $156K bloqueados"],
            ["3", "Tiempo de detección bajó a 1.4s", "antes: 18 min por caso"],
          ].map(([n, t, sub]) => (
            <div key={n} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <div className="serif" style={{ fontSize: 26, color: "var(--andes-orange)", fontWeight: 600, lineHeight: 1 }}>{n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{sub}</div>
              </div>
            </div>
          ))}
          <button className="btn block" style={{ marginTop: 14 }}><FaFileAlt size={12} /> Generar resumen ejecutivo</button>
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
              <div style={{ width: 18, height: `${(d.manual/max)*100}%`, background: "var(--line-strong)", borderRadius: "3px 3px 0 0" }}/>
              <div style={{ width: 18, height: `${(d.real/max)*100}%`, background: "linear-gradient(180deg, var(--andes-orange), var(--guayaba-red))", borderRadius: "3px 3px 0 0", position: "relative" }}>
                <div className="tabular mono" style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "var(--guayaba-red)", fontWeight: 600 }}>${d.real}K</div>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{d.m}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--andes-orange)", marginRight: 4, verticalAlign: "middle" }}/> con AchachAI</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--line-strong)", marginRight: 4, verticalAlign: "middle" }}/> detección manual</span>
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
        <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>Threshold de alerta</div>
        <div className="serif tabular" style={{ fontSize: 48, fontWeight: 500, color: "var(--andes-orange)", lineHeight: 1, marginTop: 4 }}>{t}</div>
        <input
          type="range" min={30} max={95} value={t} onChange={e => setT(+e.target.value)}
          style={{ width: "100%", marginTop: 12, accentColor: "var(--andes-orange)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-mute)" }}>
          <span>30 (sensible)</span><span>95 (conservador)</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <KpiCard label="Detección" value={`${detection}%`} sub="de casos sospechosos" tone="green"/>
        <KpiCard label="Falsos positivos" value={`${fp}%`} sub="casos buenos alertados" tone="orange"/>
        <KpiCard label="Recuperación est." value={`$${recovered}K`} sub="proyección mensual" tone="wing"/>
      </div>
    </div>
  );
}

