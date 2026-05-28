'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Condor, VueloDelCondor } from './Condor';

/* ============================================================
   MODO INVESTIGACIÓN PROFUNDA — datos REALES del backend
   ============================================================ */

const API =
  (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_API_URL) ||
  'http://localhost:8000';

const NIVEL_TONE: Record<string, 'red' | 'amber' | 'wing'> = {
  ROJO: 'red',
  AMARILLO: 'amber',
  VERDE: 'wing',
};

function fmtUSD(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function shortFecha(s?: string | null) {
  if (!s) return '—';
  return String(s).slice(0, 10);
}

/* ============================================================ */

export function InvestigationScreen({ caseId = 'SIN-100029', onBack, onVerAsegurado }: any) {
  const [detail, setDetail] = useState<any>(null);
  const [similares, setSimilares] = useState<any[]>([]);
  const [docsSubidos, setDocsSubidos] = useState<any[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [committee, setCommittee] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Fetch real data when caseId changes
  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setSimilares([]);
    setLoadErr(null);
    setStep(-1);

    async function load() {
      try {
        const [dResp, sResp, docsResp] = await Promise.all([
          fetch(`${API}/casos/${encodeURIComponent(caseId)}`, { cache: 'no-store' }),
          fetch(`${API}/casos/${encodeURIComponent(caseId)}/similares?top_n=5`, { cache: 'no-store' }),
          fetch(`${API}/casos/${encodeURIComponent(caseId)}/documentos`, { cache: 'no-store' }),
        ]);
        if (!dResp.ok) {
          throw new Error(`HTTP ${dResp.status} al obtener detalle`);
        }
        const d = await dResp.json();
        const s = sResp.ok ? await sResp.json() : { similares: [] };
        const docs = docsResp.ok ? await docsResp.json() : { documentos: [] };
        if (cancelled) return;
        setDetail(d);
        setSimilares(s.similares || []);
        setDocsSubidos(docs.documentos || []);
        // arrancamos la bitácora una vez que tengamos los datos
        runBitacora(d, s.similares || []);
      } catch (e: any) {
        if (!cancelled) setLoadErr(e?.message || String(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [caseId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [step]);

  // Build the bitácora steps from REAL data
  function buildBitacora(d: any, sims: any[]) {
    const reglas = (d?.reglas_criticas || []) as any[];
    const senales = (d?.senales_activadas || []) as any[];
    const sid = d?.siniestro?.id_siniestro || caseId;
    const provNombre = d?.proveedor?.nombre || '—';
    const provId = d?.siniestro?.id_proveedor || '—';
    const ciudad = d?.siniestro?.ciudad_evento || '—';
    const cobertura = d?.siniestro?.cobertura || '—';
    const monto = d?.siniestro?.monto_reclamado_usd || 0;
    const ndocs = d?.n_documentos || 0;
    const score = d?.score ?? 0;
    const nivel = d?.nivel || 'VERDE';

    const tone = (s: number) => (s >= 76 ? 'warn' : s >= 50 ? 'warn' : 'ok');

    const reglaTexts = reglas.length
      ? reglas.map((r: any) => `${r.codigo} (${r.nombre})`)
      : ['ninguna regla crítica disparada'];

    const senalTexts = senales.length
      ? senales.slice(0, 4).map((s: any) => `S${s.id} · ${s.nombre} (+${s.puntos} pts)`)
      : ['ninguna señal activa'];

    const simTexts = sims.length
      ? [
          `${sims.length} casos similares (sim ≥ ${sims[sims.length - 1].similitud.toFixed(2)})`,
          ...(sims[0]?.proveedor
            ? [`top match: ${sims[0].id_siniestro} · ${sims[0].proveedor}`]
            : []),
        ]
      : ['sin pares de alta similitud precomputados'];

    return [
      {
        t: '00:01',
        icon: '🦅',
        text: `Recuperando datos del siniestro ${sid} desde DuckDB…`,
        flag: 'ok',
        detail: [`Cobertura ${cobertura} · ciudad ${ciudad}`, `Monto reclamado ${fmtUSD(monto)}`],
      },
      {
        t: '00:03',
        icon: '📊',
        text: `Calculando score con XGBoost + reglas de negocio…`,
        flag: tone(score),
        detail: [`Score ${score}/100 · nivel ${nivel}`],
      },
      {
        t: '00:04',
        icon: '📋',
        text: `Aplicando 7 reglas críticas RF-01..07 y 14 señales ponderadas…`,
        flag: reglas.length ? 'warn' : 'ok',
        detail: reglaTexts,
      },
      {
        t: '00:06',
        icon: '🚦',
        text: `Evaluando ${senales.length} señales activas sobre 14 totales…`,
        flag: senales.length >= 3 ? 'warn' : 'ok',
        detail: senalTexts,
      },
      {
        t: '00:08',
        icon: '📄',
        text: `Auditando ${ndocs} documentos adjuntos al expediente…`,
        flag: ndocs < 3 ? 'warn' : 'ok',
        detail:
          ndocs === 0
            ? ['no se reportan documentos cargados']
            : [`${ndocs} documento(s) en la carpeta del siniestro`],
      },
      {
        t: '00:11',
        icon: '🔍',
        text: `Buscando narrativas similares (text-embedding-3-large)…`,
        flag: sims.length ? 'warn' : 'ok',
        detail: simTexts,
      },
      {
        t: '00:14',
        icon: '🕸',
        text: `Analizando red de relaciones del proveedor ${provId}…`,
        flag: 'ok',
        detail: [`${provNombre || '—'}${d?.proveedor?.lista_restrictiva ? ' · ⚠ lista restrictiva' : ''}`],
      },
      {
        t: '00:16',
        icon: '✨',
        text: `Sintetizando informe ejecutivo 360°…`,
        flag: 'ok',
        detail: [d?.explicacion || 'explicación generada por el motor de reglas'],
      },
    ];
  }

  const BITACORA = detail ? buildBitacora(detail, similares) : [];

  async function runBitacora(d: any, sims: any[]) {
    const steps = buildBitacora(d, sims);
    setRunning(true);
    setStep(-1);
    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 500 : 900));
      setStep(i);
    }
    setRunning(false);
  }

  function reset() {
    if (detail) runBitacora(detail, similares);
  }

  // ---- estados de pantalla ----
  if (loadErr) {
    return (
      <ErrorState caseId={caseId} err={loadErr} onBack={onBack} />
    );
  }

  if (!detail) {
    return <LoadingState caseId={caseId} onBack={onBack} />;
  }

  const score = detail.score ?? 0;
  const nivel = detail.nivel || 'VERDE';
  const tone = NIVEL_TONE[nivel] || 'wing';
  const sid = detail.siniestro?.id_siniestro || caseId;
  const cob = detail.siniestro?.cobertura || '—';
  const ciudad = detail.siniestro?.ciudad_evento || '—';
  const veh = detail.vehiculo
    ? `${detail.vehiculo.marca || ''} ${detail.vehiculo.modelo || ''} ${detail.vehiculo.anio || ''}`.trim()
    : '—';
  const reglas = (detail.reglas_criticas || []) as any[];
  const senales = (detail.senales_activadas || []) as any[];

  const showSummary = step >= 0;
  const showSignals = step >= 3;
  const showDocs = step >= 4;
  const showPatterns = step >= 5;
  const showNetwork = step >= 6;
  const showActions = step >= 7;

  const subLabel = `Confianza ${nivel} · ${reglas.length} regla(s) crítica(s) · ${senales.length} señal(es) activa(s)`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--marfil)' }}>
      {/* header */}
      <div
        style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          background:
            tone === 'red'
              ? 'linear-gradient(180deg, rgba(197,51,58,0.06), transparent)'
              : tone === 'amber'
              ? 'linear-gradient(180deg, rgba(212,165,116,0.10), transparent)'
              : 'linear-gradient(180deg, rgba(74,124,89,0.06), transparent)',
        }}
      >
        <button className="btn ghost" onClick={onBack} style={{ padding: '6px 10px', fontSize: 12 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '.18em',
              color: tone === 'red' ? 'var(--guayaba-red)' : 'var(--andes-orange)',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            🦅 Modo Investigación Profunda · datos reales
          </div>
          <h2 style={{ fontSize: 24, marginTop: 2 }}>
            {sid} ·{' '}
            <span
              style={{
                color: 'var(--ink-mute)',
                fontFamily: 'var(--sans)',
                fontWeight: 400,
                fontSize: 16,
              }}
            >
              {veh} · {cob.toLowerCase()} · {ciudad}
            </span>
          </h2>
        </div>
        <VueloDelCondor score={score} variant="md" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {detail?.siniestro?.id_asegurado && onVerAsegurado && (
            <button
              className="btn"
              onClick={() => onVerAsegurado(detail.siniestro.id_asegurado)}
              style={{ fontSize: 11 }}
            >
              👤 Ver asegurado {detail.siniestro.id_asegurado}
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() => setCommittee((c) => !c)}
            style={{ fontSize: 11 }}
          >
            {committee ? 'Salir Modo Comité' : '🎬 Modo Comité'}
          </button>
          <button className="btn ghost" onClick={reset} style={{ fontSize: 11 }} disabled={running}>
            ↻ Reproducir investigación
          </button>
        </div>
      </div>

      {/* body */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: committee ? '1fr' : '380px 1fr',
          minHeight: 0,
        }}
      >
        {/* bitácora */}
        {!committee && (
          <div
            style={{
              borderRight: '1px solid var(--line)',
              background: 'var(--marfil-paper)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div style={{ padding: '16px 20px 8px' }}>
              <div className="diamond-divider">Bitácora del cóndor</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6 }}>
                {running ? (
                  <>
                    <span style={{ color: 'var(--andes-orange)' }}>● en vuelo</span> · paso{' '}
                    {step + 1} de {BITACORA.length}
                  </>
                ) : (
                  <>✓ {BITACORA.length} pasos completados</>
                )}
              </div>
            </div>
            <div ref={logRef} style={{ flex: 1, overflow: 'auto', padding: '12px 20px 20px' }}>
              {BITACORA.slice(0, step + 1).map((b: any, i: number) => (
                <BitacoraStep key={i} b={b} latest={i === step && running} />
              ))}
              {running && step >= 0 && step < BITACORA.length - 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 8,
                    fontSize: 11,
                    color: 'var(--ink-mute)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--andes-orange)',
                      animation: 'pulse-amber 1s infinite',
                    }}
                  />
                  cóndor pensando…
                </div>
              )}
            </div>
          </div>
        )}

        {/* informe */}
        <div
          style={{
            overflow: 'auto',
            padding: committee ? '32px 64px' : '20px 28px',
            minHeight: 0,
          }}
        >
          {!showSummary && (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                height: '100%',
                color: 'var(--ink-mute)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Condor size={64} mood="alert" tone={tone === 'red' ? 'red' : 'orange'} />
                <div style={{ marginTop: 12 }}>El cóndor despega…</div>
              </div>
            </div>
          )}

          {showSummary && (
            <ReportSection n={1} title="Resumen ejecutivo" tone={tone}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr',
                  gap: 24,
                  alignItems: 'center',
                }}
              >
                <VueloDelCondor score={score} variant="lg" sublabel={subLabel} />
                <div>
                  <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                    “{detail.explicacion || 'Sin explicación generada por el motor de reglas.'}”
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    {reglas.slice(0, 4).map((r: any) => (
                      <span key={r.codigo} className="chip red">
                        {r.codigo}
                      </span>
                    ))}
                    {senales.slice(0, 4).map((s: any) => (
                      <span key={s.id} className="chip amber">
                        S{s.id} +{s.puntos}
                      </span>
                    ))}
                    {detail.proveedor?.lista_restrictiva && (
                      <span className="chip red">proveedor en lista restrictiva</span>
                    )}
                    {similares.length > 0 && (
                      <span className="chip blue">{similares.length} casos similares</span>
                    )}
                  </div>
                </div>
              </div>
            </ReportSection>
          )}

          {/* SECCIÓN VISUAL — desglose del score con barras animadas */}
          {showSummary && (
            <ReportSection n={2} title="Anatomía del score" sub="cómo se construyó este 76/100">
              <ScoreBreakdown
                score={score}
                nivel={nivel}
                reglas={reglas}
                senales={senales}
              />
            </ReportSection>
          )}

          {/* SECCIÓN — comparativo vs cartera promedio */}
          {showSummary && detail?.siniestro && (
            <ReportSection n={3} title="Cómo se compara con la cartera" sub="benchmarks de la cartera vehicular completa">
              <ComparativoCartera
                monto={detail.siniestro.monto_reclamado_usd}
                dias_inicio={detail.siniestro.dias_desde_inicio_poliza}
                dias_reporte={detail.siniestro.dias_entre_ocurrencia_reporte}
                historial={detail.asegurado?.reclamos_12m}
              />
            </ReportSection>
          )}

          {showSignals && (
            <ReportSection
              n={4}
              title="Reglas críticas y señales activadas"
              sub={`${reglas.length} regla(s) crítica(s) · ${senales.length} señal(es) ponderada(s)`}
            >
              {reglas.length === 0 && senales.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                  Ninguna regla crítica ni señal disparada. El caso luce limpio.
                </div>
              )}
              {reglas.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    Reglas críticas (RF-01..07)
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
                    {reglas.map((r: any) => (
                      <div
                        key={r.codigo}
                        style={{
                          display: 'flex',
                          gap: 10,
                          padding: '8px 12px',
                          background: 'rgba(197,51,58,0.06)',
                          borderRadius: 8,
                          border: '1px solid rgba(197,51,58,0.18)',
                        }}
                      >
                        <span className="mono chip red" style={{ fontSize: 10 }}>
                          {r.codigo}
                        </span>
                        <div style={{ flex: 1, fontSize: 12.5 }}>
                          <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                          {r.evidencia && (
                            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{r.evidencia}</div>
                          )}
                          {r.clasificacion && (
                            <span
                              className={`chip mono ${
                                r.clasificacion === 'ROJO' ? 'red' : 'amber'
                              }`}
                              style={{ fontSize: 9, marginTop: 4, display: 'inline-block' }}
                            >
                              fuerza {r.clasificacion}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {senales.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    Señales ponderadas (1..14)
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {senales.map((s: any) => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 12px',
                          background: 'var(--marfil-paper)',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                        }}
                      >
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                          S{s.id}
                        </span>
                        <div style={{ flex: 1, fontSize: 12.5 }}>
                          {s.nombre}
                          {s.evidencia && (
                            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{s.evidencia}</div>
                          )}
                        </div>
                        <span
                          className="chip amber mono"
                          style={{ fontSize: 10 }}
                        >
                          +{s.puntos}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ReportSection>
          )}

          {showDocs && (
            <ReportSection
              n={5}
              title="Estado documental"
              sub={`${detail.n_documentos} base · ${docsSubidos.length} subido(s) por el analista`}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: docsSubidos.length ? 16 : 0 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    background: detail.n_documentos < 3 ? 'rgba(212,165,116,0.18)' : 'rgba(74,124,89,0.12)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 26,
                  }}
                >
                  📄
                </div>
                <div>
                  <div style={{ fontSize: 26, fontFamily: 'var(--serif)', fontWeight: 600 }}>
                    {detail.n_documentos} documento{detail.n_documentos === 1 ? '' : 's'} en el expediente original
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                    {detail.n_documentos < 3
                      ? '⚠ Cobertura documental por debajo del mínimo esperado (3+).'
                      : '✓ Cobertura documental aceptable.'}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    className="btn ghost"
                    style={{ fontSize: 11 }}
                    onClick={() => window.open(`${API}/casos/${encodeURIComponent(sid)}`, '_blank')}
                  >
                    Ver JSON completo →
                  </button>
                </div>
              </div>

              {docsSubidos.length > 0 && (
                <>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Documentos subidos por el analista (Azure DI + GPT-4o)
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {docsSubidos.map((d: any) => {
                      const nivel = d.nivel_riesgo_doc;
                      const tone = nivel === 'ROJO' ? 'red' : nivel === 'AMARILLO' ? 'amber' : 'green';
                      const tc = tone === 'red' ? 'var(--guayaba-red)' : tone === 'amber' ? 'var(--andes-ocher)' : 'var(--paramo-green)';
                      return (
                        <div key={d.id_documento} style={{
                          display: 'grid', gridTemplateColumns: '24px 1fr 80px 80px 100px',
                          gap: 10, alignItems: 'center', padding: '8px 12px',
                          background: 'var(--marfil-paper)', borderRadius: 8,
                          borderLeft: `3px solid ${tc}`,
                        }}>
                          <span style={{ fontSize: 18 }}>
                            {d.tipo === 'factura' ? '🧾' : d.tipo === 'imagen_dano' ? '📷' : d.tipo === 'parte_policial' ? '🚓' : '📄'}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.nombre_archivo}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>
                              {d.tipo} · {String(d.fecha_subida).slice(0, 16).replace('T', ' ')} · {d.analista_id}
                            </div>
                          </div>
                          <span className="chip mono" style={{ fontSize: 9.5 }}>score {d.score_doc}</span>
                          <span className={`chip mono ${tone}`} style={{ fontSize: 9.5 }}>{nivel || '—'}</span>
                          {d.n_inconsistencias > 0 && (
                            <span className="chip red" style={{ fontSize: 9 }}>{d.n_inconsistencias} inconsist.</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </ReportSection>
          )}

          {showPatterns && (
            <ReportSection
              n={6}
              title="Narrativas similares"
              sub="text-embedding-3-large · top pares precomputados"
            >
              {similares.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                  Sin pares de alta similitud para este siniestro en el ranking precomputado.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {similares.map((s: any) => (
                      <div
                        key={s.id_siniestro}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          background: 'var(--marfil-paper)',
                          borderRadius: 10,
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div
                          className="mono"
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--mountain-blue)' }}
                        >
                          {s.id_siniestro}
                        </div>
                        <SimBar value={s.similitud} />
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', flex: 1 }}>
                          {s.ciudad || '—'} · {s.vehiculo || '—'} · {(s.cobertura || '').toLowerCase()}
                        </div>
                        {s.id_proveedor && (
                          <span
                            className={`chip mono ${
                              s.id_proveedor === detail.siniestro?.id_proveedor ? 'red' : 'blue'
                            }`}
                            style={{ fontSize: 10 }}
                          >
                            {s.id_proveedor}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {similares.some(
                    (s) => s.id_proveedor === detail.siniestro?.id_proveedor,
                  ) && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11.5,
                        color: 'var(--andes-orange)',
                        fontWeight: 600,
                      }}
                    >
                      → Coincidencia de proveedor entre casos similares: posible red organizada
                    </div>
                  )}
                </>
              )}
            </ReportSection>
          )}

          {showNetwork && (
            <ReportSection n={7} title="Proveedor del caso" sub="ficha rápida">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '240px 1fr',
                  gap: 18,
                  alignItems: 'center',
                }}
              >
                <MiniTejido />
                <div>
                  <div
                    style={{
                      fontSize: 17,
                      fontFamily: 'var(--serif)',
                      color: 'var(--condor-wing)',
                    }}
                  >
                    {detail.siniestro?.id_proveedor || '—'} ·{' '}
                    <span style={{ color: 'var(--ink-mute)' }}>
                      “{detail.proveedor?.nombre || '—'}”
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 12,
                      marginTop: 14,
                    }}
                  >
                    <Stat label="Tipo" value={detail.proveedor?.tipo || '—'} />
                    <Stat
                      label="Lista restrictiva"
                      value={detail.proveedor?.lista_restrictiva ? 'SÍ' : 'NO'}
                      tone={detail.proveedor?.lista_restrictiva ? 'red' : undefined}
                    />
                    <Stat
                      label="Monto reclamado"
                      value={fmtUSD(detail.siniestro?.monto_reclamado_usd)}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 10 }}>
                    Para el grafo completo del cluster usa{' '}
                    <span className="mono">Tejido del Fraude</span> en la barra lateral.
                  </div>
                </div>
              </div>
            </ReportSection>
          )}

          {showActions && (
            <ReportSection n={8} title="Acciones recomendadas y tu decisión" tone="orange">
              <DynamicActions detail={detail} similares={similares} />
              <FeedbackActions
                sid={sid}
                score={score}
                nivel={nivel}
                onBack={onBack}
              />
            </ReportSection>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function FeedbackActions({ sid, score, nivel, onBack }: any) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justif, setJustif] = useState('');

  async function decidir(decision: string) {
    setBusy(true);
    try {
      const r = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_siniestro: sid,
          decision,
          justificacion: justif || `Decisión desde Modo Investigación`,
          analista_id: 'ana.yanez',
          score_modelo: score,
          nivel_modelo: nivel,
        }),
      });
      const d = await r.json();
      if (d?.ok) {
        setSent(`✓ Registrado como "${decision}". Total feedbacks acumulados: ${d.total_feedbacks}.`);
      } else {
        setSent('⚠ El backend respondió sin OK. Revisa logs.');
      }
    } catch (e: any) {
      setSent(`⚠ Error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        style={{
          marginTop: 14,
          fontSize: 11.5,
          color: 'var(--ink-mute)',
          padding: '10px 12px',
          background: 'var(--marfil-paper)',
          borderRadius: 8,
          borderLeft: '3px solid var(--andes-orange)',
        }}
      >
        ⚠️ Esto es una recomendación generada por el cóndor. La decisión final es del analista humano.
      </div>

      <div style={{ marginTop: 14, padding: 12, background: 'white', border: '1px solid var(--line)', borderRadius: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, color: 'var(--condor-wing)' }}>
          Tu decisión sobre {sid}
        </div>
        <textarea
          value={justif}
          onChange={(e) => setJustif(e.target.value)}
          placeholder="Justificación (opcional)…"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '6px 10px',
            border: '1px solid var(--line-strong)', borderRadius: 6,
            fontSize: 12, fontFamily: 'inherit', resize: 'vertical', marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy} onClick={() => decidir('aprobar')}>
            ✓ Aprobar pago
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => decidir('retener')}>
            ⏸ Retener
          </button>
          <button className="btn warm" disabled={busy} onClick={() => decidir('bloquear')}>
            🚫 Bloquear pago
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => decidir('escalar')}>
            📤 Escalar a comité
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onBack}>
            💬 Volver al cóndor
          </button>
        </div>
        {sent && (
          <div
            style={{
              marginTop: 10,
              padding: '6px 10px',
              background: sent.startsWith('✓') ? 'rgba(74,124,89,0.10)' : 'rgba(197,51,58,0.08)',
              borderRadius: 6,
              fontSize: 11.5,
              color: sent.startsWith('✓') ? 'var(--paramo-green)' : 'var(--guayaba-red)',
            }}
          >
            {sent}
          </div>
        )}
        <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 8, fontStyle: 'italic' }}>
          La decisión se persiste a <span className="mono">data/processed/feedback_analistas.parquet</span> y alimenta el aprendizaje continuo del cóndor.
        </div>
      </div>
    </>
  );
}

function LoadingState({ caseId, onBack }: any) {
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--marfil)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Condor size={72} mood="think" tone="orange" />
        <div style={{ marginTop: 14, fontFamily: 'var(--serif)', fontSize: 20 }}>
          Solicitando expediente {caseId} al backend…
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-mute)' }}>
          GET /casos/{caseId}
        </div>
        <button
          className="btn ghost"
          onClick={onBack}
          style={{ marginTop: 18, fontSize: 12 }}
        >
          ← Cancelar
        </button>
      </div>
    </div>
  );
}

function ErrorState({ caseId, err, onBack }: any) {
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--marfil)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <Condor size={72} mood="alert" tone="red" />
        <div style={{ marginTop: 14, fontFamily: 'var(--serif)', fontSize: 20 }}>
          No pude recuperar {caseId}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--guayaba-red)' }}>{err}</div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-mute)' }}>
          Verifica que <span className="mono">uvicorn src.api.main:app</span> esté corriendo en{' '}
          <span className="mono">{API}</span>.
        </div>
        <button
          className="btn ghost"
          onClick={onBack}
          style={{ marginTop: 18, fontSize: 12 }}
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}

function DynamicActions({ detail, similares }: any) {
  const score = detail.score ?? 0;
  const nivel = detail.nivel || 'VERDE';
  const monto = detail.siniestro?.monto_reclamado_usd || 0;
  const provId = detail.siniestro?.id_proveedor;
  const provNombre = detail.proveedor?.nombre || provId;
  const provListaRestr = !!detail.proveedor?.lista_restrictiva;
  const matchProv = similares.filter((s: any) => s.id_proveedor === provId);

  const actions: [string, string][] = [];

  if (nivel === 'ROJO') {
    actions.push([
      `BLOQUEAR pago pendiente del caso ${detail.siniestro?.id_siniestro}`,
      `Score ${score} · evita exposición de ${fmtUSD(monto)}`,
    ]);
  } else if (nivel === 'AMARILLO') {
    actions.push([
      `RETENER pago y solicitar evidencia complementaria`,
      `Score ${score} · monto ${fmtUSD(monto)}`,
    ]);
  } else {
    actions.push([
      `Continuar flujo normal con monitoreo`,
      `Score ${score} · nivel ${nivel}`,
    ]);
  }

  if (matchProv.length >= 2 || provListaRestr) {
    actions.push([
      `ABRIR investigación al proveedor ${provId}`,
      `${provNombre}${provListaRestr ? ' · ya en lista restrictiva' : ''}${
        matchProv.length ? ` · coincide en ${matchProv.length} caso(s) similar(es)` : ''
      }`,
    ]);
  }

  if (similares.length >= 3) {
    actions.push([
      `REVISAR los ${similares.length} casos similares como cluster`,
      `Similitud mínima ${similares[similares.length - 1].similitud.toFixed(2)}`,
    ]);
  }

  if (detail.n_documentos < 3) {
    actions.push([
      `SOLICITAR documentación faltante al asegurado`,
      `${detail.n_documentos} doc(s) cargado(s) — mínimo recomendado 3`,
    ]);
  }

  actions.push([
    `Registrar feedback del analista en la bitácora`,
    `Mejora el aprendizaje continuo del modelo`,
  ]);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {actions.map(([t, sub], i) => (
        <label
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'white',
            borderRadius: 10,
            border: '1px solid var(--line)',
            cursor: 'pointer',
          }}
        >
          <input type="checkbox" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {i + 1}. {t}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{sub}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

function BitacoraStep({ b, latest }: any) {
  const bg = b.flag === 'warn' ? 'rgba(212,165,116,0.08)' : 'white';
  return (
    <div
      className="fade-up"
      style={{
        borderLeft: `2px solid var(--${b.flag === 'warn' ? 'andes-orange' : 'paramo-green'})`,
        paddingLeft: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
          ⏱ {b.t}
        </span>
        <span style={{ fontSize: 13 }}>{b.icon}</span>
        {!latest && <span style={{ color: 'var(--paramo-green)', fontSize: 11 }}>✓</span>}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--condor-wing)',
          lineHeight: 1.45,
          background: bg,
          padding: '6px 10px',
          borderRadius: 8,
          borderLeft: latest ? '2px solid var(--andes-orange)' : 'none',
        }}
      >
        {b.text}
        {latest && (
          <span style={{ marginLeft: 2, animation: 'typewriter-blink 0.8s infinite' }}>▍</span>
        )}
        {b.detail && (
          <ul
            style={{
              margin: '6px 0 0 0',
              padding: '0 0 0 16px',
              fontSize: 11,
              color: 'var(--ink-soft)',
            }}
          >
            {b.detail.map((d: string, i: number) => (
              <li key={i}>→ {d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReportSection({ n, title, sub, tone = 'wing', children }: any) {
  const accent =
    tone === 'red'
      ? 'var(--guayaba-red)'
      : tone === 'orange' || tone === 'amber'
      ? 'var(--andes-orange)'
      : 'var(--condor-wing)';
  return (
    <div
      className="card fade-up"
      style={{
        padding: 22,
        marginBottom: 16,
        position: 'relative',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <div
          className="mono"
          style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '.2em' }}
        >
          §{String(n).padStart(2, '0')}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 500 }}>{title}</h3>
        {sub && (
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 'auto' }}>{sub}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function SimBar({ value }: any) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 140 }}>
      <div
        style={{
          flex: 1,
          height: 5,
          background: 'var(--line)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${v * 100}%`,
            height: '100%',
            background: 'var(--guayaba-red)',
          }}
        />
      </div>
      <span
        className="mono"
        style={{ fontSize: 10, color: 'var(--guayaba-red)', fontWeight: 600 }}
      >
        {v.toFixed(2)}
      </span>
    </div>
  );
}

function Stat({ label, value, tone }: any) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--marfil-paper)', borderRadius: 8 }}>
      <div
        className="serif tabular"
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: tone === 'red' ? 'var(--guayaba-red)' : 'var(--condor-wing)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--ink-mute)',
          marginTop: 4,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ============================================================
   SCORE BREAKDOWN — descomposición HONESTA del score final
   Logica real: score = max(sum(senales), minimo_forzado_por_reglas_criticas)
     - Sin reglas activas: score = sum(senales)
     - RF AMARILLO activa: score = max(sum(senales), 41)
     - RF ROJO activa:     score = max(sum(senales), 76)
   ============================================================ */
function ScoreBreakdown({ score, nivel, reglas, senales }: any) {
  const tone = nivel === 'ROJO' ? 'var(--guayaba-red)'
             : nivel === 'AMARILLO' ? 'var(--andes-orange)'
             : 'var(--paramo-green)';

  const ptsSenales = (senales || []).reduce((a: number, s: any) => a + (s.puntos || 0), 0);
  const reglasActivas = reglas || [];
  // Calculamos el minimo forzado segun reglas
  let minimoForzado = 0;
  let claseForzada: string | null = null;
  for (const r of reglasActivas) {
    if (r.clasificacion === 'ROJO' || r.nivel === 'ROJO') {
      if (76 > minimoForzado) { minimoForzado = 76; claseForzada = 'ROJO'; }
    } else if (r.clasificacion === 'AMARILLO' || r.nivel === 'AMARILLO') {
      if (41 > minimoForzado) { minimoForzado = 41; claseForzada = 'AMARILLO'; }
    }
  }
  // El "boost por override" es lo que las reglas SUMARON al score base
  const ptsOverride = Math.max(0, score - ptsSenales);
  const usaOverride = minimoForzado > 0 && score >= minimoForzado && ptsOverride > 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'center' }}>
      {/* Gauge gigante */}
      <div style={{ textAlign: 'center' }}>
        <svg viewBox="0 0 200 200" style={{ width: 180, height: 180 }}>
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--line)" strokeWidth="12" />
          <circle
            cx="100" cy="100" r="80" fill="none" stroke={tone} strokeWidth="12"
            strokeDasharray={`${(score/100) * 502} 502`}
            strokeDashoffset="125.5"
            transform="rotate(-90 100 100)"
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
          <text x="100" y="98" textAnchor="middle" fontSize="44" fontWeight="600" fill={tone} fontFamily="var(--serif)">
            {score}
          </text>
          <text x="100" y="122" textAnchor="middle" fontSize="11" fill="var(--ink-mute)" letterSpacing="2">/100</text>
          <text x="100" y="148" textAnchor="middle" fontSize="13" fontWeight="700" fill={tone}>{nivel}</text>
        </svg>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Cómo se calculó este {score}
        </div>

        {/* Componente 1: suma de señales */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
            <span style={{ color: 'var(--condor-wing)' }}>
              <strong>① Suma de las {(senales||[]).length} señales activas</strong>
              <span style={{ color: 'var(--ink-mute)' }}> · S1..S14 con pesos del PDF</span>
            </span>
            <span className="tabular mono" style={{ color: 'var(--andes-orange)', fontWeight: 600 }}>
              {ptsSenales} / 100 pts
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, ptsSenales)}%`, height: '100%',
              background: 'var(--andes-orange)', borderRadius: 4,
              transition: 'width 0.9s ease',
            }} />
          </div>
        </div>

        {/* Componente 2: override por reglas críticas (solo si aplica) */}
        {reglasActivas.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
              <span style={{ color: 'var(--condor-wing)' }}>
                <strong>② Override por {reglasActivas.length} regla(s) crítica(s)</strong>
                <span style={{ color: 'var(--ink-mute)' }}> · {reglasActivas.map((r: any) => r.codigo).join(', ')}</span>
              </span>
              <span className="tabular mono" style={{ color: 'var(--guayaba-red)', fontWeight: 600 }}>
                {usaOverride ? `→ ${score} pts` : `(no afecta)`}
              </span>
            </div>
            <div style={{
              padding: '6px 10px', background: 'rgba(197,51,58,0.06)',
              borderRadius: 6, fontSize: 10.5, color: 'var(--ink-soft)',
              borderLeft: '2px solid var(--guayaba-red)',
            }}>
              {claseForzada === 'ROJO' && (
                <>Cuando una regla RF-01..04 (ROJO) se activa, el score sube automáticamente a <strong>≥76</strong> sin importar las señales.</>
              )}
              {claseForzada === 'AMARILLO' && (
                <>Cuando una regla RF-05..07 (AMARILLO) se activa, el score sube a <strong>≥41</strong> sin importar las señales.</>
              )}
              {!claseForzada && 'Las reglas activas no fuerzan nivel — solo aportan contexto.'}
            </div>
          </div>
        )}

        {/* Fórmula explícita */}
        <div style={{
          marginTop: 4, padding: '8px 12px', background: `${tone}12`,
          borderRadius: 6, fontSize: 11.5, color: 'var(--ink-soft)',
          borderLeft: `3px solid ${tone}`,
        }}>
          <strong style={{ color: tone }}>Fórmula final:</strong>{' '}
          {reglasActivas.length > 0 && minimoForzado > 0 ? (
            <>
              score = max(<strong>{ptsSenales}</strong> señales, <strong>{minimoForzado}</strong> mínimo por {claseForzada}) = <strong>{score}</strong> · nivel <strong>{nivel}</strong>
            </>
          ) : (
            <>
              score = suma de señales = <strong>{ptsSenales}</strong> · nivel <strong>{nivel}</strong>{' '}
              {score >= 76 ? '(≥76 → ROJO)' : score >= 41 ? '(41-75 → AMARILLO)' : '(≤40 → VERDE)'}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COMPARATIVO VS CARTERA — benchmarks visuales
   ============================================================ */
function ComparativoCartera({ monto, dias_inicio, dias_reporte, historial }: any) {
  // Benchmarks aproximados del dataset (calculados offline para no hacer otro fetch)
  const benchmarks = [
    { label: 'Monto reclamado', val: monto, mediana: 5025, p95: 28000, fmt: (v: number) => `$${(v||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { label: 'Días inicio póliza', val: dias_inicio, mediana: 190, p95: 360, fmt: (v: number) => `${v}d` },
    { label: 'Días evento → reporte', val: dias_reporte, mediana: 8, p95: 45, fmt: (v: number) => `${v}d` },
    { label: 'Siniestros previos', val: historial, mediana: 1, p95: 5, fmt: (v: number) => `${v}` },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      {benchmarks.map((b, i) => {
        const val = b.val ?? 0;
        // Posición relativa: 0 = mediana, 1 = p95, >1 = más allá
        const ratio = val / Math.max(1, b.mediana);
        const ratioP95 = val / Math.max(1, b.p95);
        const tone = ratioP95 >= 1 ? 'var(--guayaba-red)'
                   : ratio >= 2 ? 'var(--andes-orange)'
                   : 'var(--paramo-green)';
        const interpretacion = ratioP95 >= 1 ? `${ratioP95.toFixed(1)}x el p95 — entre el 5% más extremo`
                              : ratio >= 2 ? `${ratio.toFixed(1)}x la mediana — alto pero no extremo`
                              : ratio >= 1 ? `${ratio.toFixed(1)}x la mediana — normal`
                              : `${(ratio).toFixed(1)}x la mediana — por debajo del promedio`;
        // Visualización: barra horizontal con caso, mediana, p95
        const pctVal = Math.min(100, (val / (b.p95 * 1.2)) * 100);
        const pctMed = Math.min(100, (b.mediana / (b.p95 * 1.2)) * 100);
        const pctP95 = Math.min(100, (b.p95 / (b.p95 * 1.2)) * 100);
        return (
          <div key={b.label} style={{
            padding: 14, background: 'var(--marfil-paper)', borderRadius: 10,
            borderLeft: `3px solid ${tone}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--condor-wing)' }}>{b.label}</span>
              <span className="tabular mono" style={{ fontSize: 14, fontWeight: 700, color: tone }}>{b.fmt(val)}</span>
            </div>
            {/* Barra con marcas de mediana y p95 */}
            <div style={{ position: 'relative', height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'visible', marginBottom: 14 }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${pctVal}%`, background: tone, borderRadius: 4,
                transition: `width 0.8s ease ${i * 100}ms`,
              }} />
              {/* tick mediana */}
              <div style={{
                position: 'absolute', left: `${pctMed}%`, top: -4, bottom: -4,
                width: 1, background: 'var(--ink-mute)',
              }} title={`Mediana cartera: ${b.fmt(b.mediana)}`} />
              <div style={{
                position: 'absolute', left: `${pctMed}%`, bottom: -16,
                transform: 'translateX(-50%)', fontSize: 8.5, color: 'var(--ink-mute)',
              }}>med {b.fmt(b.mediana)}</div>
              {/* tick p95 */}
              <div style={{
                position: 'absolute', left: `${pctP95}%`, top: -4, bottom: -4,
                width: 1, background: 'var(--guayaba-red)', opacity: 0.5,
              }} title={`p95 cartera: ${b.fmt(b.p95)}`} />
              <div style={{
                position: 'absolute', left: `${pctP95}%`, bottom: -16,
                transform: 'translateX(-50%)', fontSize: 8.5, color: 'var(--guayaba-red)', opacity: 0.7,
              }}>p95 {b.fmt(b.p95)}</div>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 4 }}>
              {interpretacion}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniTejido() {
  return (
    <svg viewBox="0 0 240 180" style={{ width: '100%', height: 180 }}>
      <defs>
        <pattern id="andean-rhombi" width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="rgba(26,58,82,0.08)" />
        </pattern>
      </defs>
      <rect width="240" height="180" fill="var(--marfil-paper)" />
      <rect width="240" height="180" fill="url(#andean-rhombi)" />
      <g>
        {[
          [60, 30],
          [60, 90],
          [60, 150],
          [200, 40],
          [200, 100],
          [200, 160],
        ].map(([x, y], i) => (
          <line
            key={i}
            x1={120}
            y1={90}
            x2={x}
            y2={y}
            stroke="var(--guayaba-red)"
            strokeWidth="1.2"
            opacity="0.5"
          />
        ))}
        <circle cx="120" cy="90" r="14" fill="var(--guayaba-red)" />
        <text x="120" y="94" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">
          PRV
        </text>
        {[
          [60, 30],
          [60, 90],
          [60, 150],
          [200, 40],
          [200, 100],
          [200, 160],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="6" fill="var(--mountain-blue)" />
          </g>
        ))}
      </g>
      <text x="120" y="172" textAnchor="middle" fontSize="9" fill="var(--ink-mute)">
        proveedor del caso → asegurados conectados
      </text>
    </svg>
  );
}
