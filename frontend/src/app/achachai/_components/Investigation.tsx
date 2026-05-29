'use client';
// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { Condor, VueloDelCondor } from './Condor';
import { CondorTeacher } from './CondorTeacher';
import { RiskScore } from './RiskScore';
import { getRuleExplain, getSignalExplain, type RuleExplain } from './rulesCatalog';
import {
  FaArrowLeft,
  FaUserCircle,
  FaRedoAlt,
  FaTheaterMasks,
  FaShieldAlt,
  FaSearch,
  FaChartLine,
  FaClipboardCheck,
  FaTrafficLight,
  FaFileAlt,
  FaNetworkWired,
  FaLightbulb,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaBan,
  FaShareSquare,
  FaComments,
  FaFileInvoice,
  FaCamera,
  FaCarCrash,
} from 'react-icons/fa';

/* ============================================================
   MODO INVESTIGACIÓN PROFUNDA — datos REALES del backend
   ============================================================ */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

/**
 * Panel expandible con la explicación humana de una regla o señal.
 * Diseñado para que cualquier analista (no técnico) entienda qué se detectó,
 * por qué importa y qué hacer.
 */
function ExplainPanel({
  open,
  data,
  tone = 'red',
}: {
  open: boolean;
  data: RuleExplain | null;
  tone?: 'red' | 'amber';
}) {
  if (!open || !data) return null;
  const accent = tone === 'red' ? 'rgba(197,51,58,0.18)' : 'rgba(218,165,32,0.22)';
  const accentText = tone === 'red' ? 'var(--rojo, #c5333a)' : 'var(--amber-strong, #b8860b)';
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        background: 'var(--marfil-paper, #fbf7f0)',
        border: `1px solid ${accent}`,
        borderRadius: 8,
        display: 'grid',
        gap: 10,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
            marginBottom: 3,
            fontWeight: 700,
          }}
        >
          ¿Qué busca esta regla?
        </div>
        <div style={{ color: 'var(--ink, #1a1a1a)' }}>{data.descripcion}</div>
      </div>
      <div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
            marginBottom: 3,
            fontWeight: 700,
          }}
        >
          ¿Por qué importa?
        </div>
        <div style={{ color: accentText, fontWeight: 500 }}>{data.porQueImporta}</div>
      </div>
      <div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
            marginBottom: 3,
            fontWeight: 700,
          }}
        >
          ¿Qué hacer ahora?
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink, #1a1a1a)' }}>
          {data.queHacer.map((paso, i) => (
            <li key={i} style={{ marginBottom: 2 }}>
              {paso}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
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
  // Acordeón: trackea qué reglas/señales tienen el detalle expandido.
  // Key: "RULE:RF-02" o "SIGNAL:11"
  const [openExplain, setOpenExplain] = useState<Record<string, boolean>>({});
  const logRef = useRef<HTMLDivElement>(null);

  const toggleExplain = (key: string) =>
    setOpenExplain((prev) => ({ ...prev, [key]: !prev[key] }));

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
    const provRestrictivo = !!d?.proveedor?.lista_restrictiva;
    const ciudad = d?.siniestro?.ciudad_evento || '—';
    const cobertura = d?.siniestro?.cobertura || '—';
    const monto = d?.siniestro?.monto_reclamado_usd || 0;
    const ndocs = d?.n_documentos || 0;
    const score = d?.score ?? 0;
    const nivel = d?.nivel || 'VERDE';

    const tone = (s: number) => (s >= 76 ? 'warn' : s >= 50 ? 'warn' : 'ok');

    // Narrativa de cada regla en lenguaje de negocio
    const reglaTexts = reglas.length
      ? reglas.map((r: any) => `${r.codigo} — ${r.nombre}: ${r.evidencia || 'evidencia en expediente'}`)
      : ['No se activó ninguna regla crítica del manual antifraude — el caso pasa el primer filtro.'];

    const senalTexts = senales.length
      ? senales.slice(0, 4).map((s: any) => `${s.nombre} (+${s.puntos} pts) — ${s.evidencia || 'detectado en el expediente'}`)
      : ['Ninguna de las 14 señales puntuables se activó — patrón normal de la cartera.'];

    const simTexts = sims.length
      ? [
          `Encontramos ${sims.length} caso(s) con descripción muy parecida (similitud ≥ ${sims[sims.length - 1].similitud.toFixed(2)}). En fraudes seriales, los relatos se "clonan".`,
          ...(sims[0]?.proveedor
            ? [`El más parecido es ${sims[0].id_siniestro}, atendido por ${sims[0].proveedor}.`]
            : []),
        ]
      : ['Ninguna narrativa de los 40.000 casos previos se parece sospechosamente a esta. No hay indicio de relato copiado.'];

    // Informe ejecutivo cohesivo (paso 8)
    const niveLabel = nivel === 'ROJO' ? '🔴 ROJO (alto riesgo)'
                    : nivel === 'AMARILLO' ? '🟡 AMARILLO (medio)'
                    : '🟢 VERDE (bajo)';
    const recomendacion = nivel === 'ROJO'
      ? 'ESCALAR a Unidad Antifraude para revisión especializada de campo.'
      : nivel === 'AMARILLO'
      ? 'ESCALAR a Unidad Antifraude para revisión documental adicional.'
      : 'CONTINUAR flujo normal de liquidación. Sin alertas significativas.';

    const razones: string[] = [];
    if (reglas.length) {
      reglas.slice(0, 3).forEach((r: any) => razones.push(`${r.codigo} — ${r.nombre}`));
    }
    if (senales.length && razones.length < 3) {
      const top = [...senales].sort((a: any, b: any) => (b.puntos || 0) - (a.puntos || 0));
      top.slice(0, 3 - razones.length).forEach((s: any) => razones.push(`${s.nombre} (+${s.puntos} pts)`));
    }
    if (provRestrictivo) razones.push(`Proveedor ${provNombre} figura en lista restrictiva interna.`);

    const informeLines: string[] = [];
    informeLines.push(`Score final: ${score}/100 · Nivel: ${niveLabel}`);
    informeLines.push(`Recomendación: ${recomendacion}`);
    if (razones.length) {
      informeLines.push('Razones principales:');
      razones.slice(0, 4).forEach((r, i) => informeLines.push(`  ${i + 1}. ${r}`));
    }
    informeLines.push('');
    informeLines.push('Lo que NO sabemos: si la causa real fue mala fe del cliente o un error del proveedor. La revisión humana decide. AchachAI solo alerta — nunca acusa.');

    return [
      {
        t: '00:01',
        icon: FaSearch,
        text: `Abriendo el expediente del siniestro ${sid}.`,
        flag: 'ok',
        detail: [
          `Cobertura: ${cobertura}. Ocurrió en ${ciudad}.`,
          `El asegurado reclama ${fmtUSD(monto)}.`,
          `Antes de juzgar, vamos a revisar 7 reglas críticas, 14 señales y comparar con 40.000 casos previos.`,
        ],
      },
      {
        t: '00:03',
        icon: FaChartLine,
        text: `Comparando este caso contra patrones de 40.000 siniestros previos.`,
        flag: tone(score),
        detail: [
          `Nuestro modelo XGBoost (AUC 0.97) calculó un score de ${score}/100.`,
          `Nivel ${nivel}: ${nivel === 'ROJO' ? 'el patrón se parece mucho a fraudes confirmados del pasado.' : nivel === 'AMARILLO' ? 'hay indicios sospechosos, vale la pena revisar más a fondo.' : 'el patrón se parece a siniestros legítimos pagados normalmente.'}`,
        ],
      },
      {
        t: '00:04',
        icon: FaClipboardCheck,
        text: `Verificando si activa alguna de las 7 reglas críticas del manual antifraude.`,
        flag: reglas.length ? 'warn' : 'ok',
        detail: reglaTexts,
      },
      {
        t: '00:06',
        icon: FaTrafficLight,
        text: `Evaluando las 14 señales ponderadas (frecuencia, montos, documentos, fechas, narrativa).`,
        flag: senales.length >= 3 ? 'warn' : 'ok',
        detail: senalTexts,
      },
      {
        t: '00:08',
        icon: FaFileAlt,
        text: `Auditando el expediente documental del caso.`,
        flag: ndocs < 3 ? 'warn' : 'ok',
        detail:
          ndocs === 0
            ? ['⚠️ Este caso NO tiene documentos cargados. En un siniestro normal esperaríamos al menos factura + denuncia + fotos. La ausencia es una señal de cautela.']
            : [
                `El expediente contiene ${ndocs} documento(s).`,
                ndocs >= 3 ? 'Cobertura documental razonable.' : 'Documentación escasa — vale la pena pedir más evidencia.',
              ],
      },
      {
        t: '00:11',
        icon: FaSearch,
        text: `Leyendo la descripción del siniestro y comparándola con 40.000 relatos previos.`,
        flag: sims.length ? 'warn' : 'ok',
        detail: simTexts,
      },
      {
        t: '00:14',
        icon: FaNetworkWired,
        text: `Mapeando la red de relaciones alrededor del proveedor ${provId}.`,
        flag: provRestrictivo ? 'warn' : 'ok',
        detail: [
          `Proveedor: ${provNombre || '—'}.`,
          provRestrictivo
            ? '🚨 Este proveedor figura en la LISTA RESTRICTIVA interna de Aseguradora del Sur (RF-03). Cada caso suyo merece revisión específica.'
            : 'No figura en la lista restrictiva. Sin alertas en su historial reciente.',
        ],
      },
      {
        t: '00:16',
        icon: FaLightbulb,
        text: `Informe ejecutivo 360° — síntesis para el analista.`,
        flag: nivel === 'ROJO' ? 'warn' : 'ok',
        detail: informeLines,
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* banner ¿Para qué sirve esta pantalla? */}
      <div
        style={{
          padding: '14px 28px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--andes-orange, #d97706)',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FaLightbulb size={11} /> ¿Para qué sirve esta pantalla?
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>El problema:</strong>{' '}
            Un caso con score alto necesita sustento antes de pagarlo, rechazarlo o escalarlo.
            Mirar tablas no alcanza — hay que reconstruir el razonamiento.
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Qué hace el cóndor:</strong>{' '}
            Reabre el expediente paso a paso: trae el caso, calcula score, revisa 7 reglas
            críticas, 14 señales, documentos, narrativa y red de proveedores. Sin saltarse nada.
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Qué hacés vos:</strong>{' '}
            Leés la bitácora paso a paso, validás la evidencia, podés cuestionar al cóndor en
            el chat lateral, y finalmente decidís: <em>liquidar</em>, <em>escalar a antifraude</em> o <em>cerrar</em>.
          </div>
        </div>
      </div>

      {/* header */}
      <div
        style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          background: 'var(--bg-card)',
          flexWrap: 'wrap',
        }}
      >
        <button className="btn ghost" onClick={onBack} style={{ padding: '6px 12px', fontSize: 12 }}>
          <FaArrowLeft size={11} /> Volver
        </button>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.16em',
              color: tone === 'red' ? 'var(--danger)' : tone === 'amber' ? 'var(--warning)' : 'var(--accent)',
              fontWeight: 700,
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FaShieldAlt size={11} /> Modo Investigación Profunda
          </div>
          <h2 className="display" style={{ fontSize: 22, marginTop: 4, color: 'var(--text-primary)' }}>
            <span className="mono">{sid}</span>{' '}
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 15 }}>
              · {veh} · {cob.toLowerCase()} · {ciudad}
            </span>
          </h2>
        </div>
        <CondorTeacher
          screen={`investigation-${sid}`}
          title="¿Te explico este caso paso a paso?"
          hook={`${sid} · score ${score}/100 · nivel ${nivel}. Recorremos la bitácora juntos.`}
          contextPrompt={`Estoy en el "Modo Investigación Profunda" del caso ${sid} en el sistema AchachAI.

DATOS DEL CASO:
- Score: ${score}/100
- Nivel: ${nivel}
- Cobertura: ${cob}
- Ciudad: ${ciudad}
- Reglas críticas activadas: ${reglas.length} (${reglas.map((r: any) => r.codigo).join(', ') || 'ninguna'})
- Señales activadas: ${senales.length}
- Documentos analizados: ${detail?.n_documentos || 0}

La pantalla muestra una "bitácora del cóndor" con 8 pasos del análisis: recuperar datos → calcular score → aplicar reglas → evaluar señales → auditar documentos → buscar narrativas similares → analizar red de proveedores → informe ejecutivo.

Por favor recorreme este caso específico paso a paso:
1. ¿Cuál es el "titular" del caso en 1 frase?
2. Para cada regla crítica activada, ¿qué significa y qué evidencia se citó?
3. ¿Qué señales agregaron más puntos y por qué?
4. ¿Hay algo en este caso que NO te cuadre o que pediría revisar manualmente?
5. ¿Qué decisión recomendarías al analista (liquidar / retener / escalar / bloquear) y por qué?

Tono amigable, latinoamericano neutro (sin "vos"). Sin acusar al asegurado. Al final dame el "telegram para el comité antifraude" en 3 líneas.`}
          position="tr"
        />
        <RiskScore score={score} variant="md" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {detail?.siniestro?.id_asegurado && onVerAsegurado && (
            <button
              className="btn"
              onClick={() => onVerAsegurado(detail.siniestro.id_asegurado)}
              style={{ fontSize: 11 }}
            >
              <FaUserCircle size={12} /> Ver asegurado {detail.siniestro.id_asegurado}
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() => setCommittee((c) => !c)}
            style={{ fontSize: 11 }}
          >
            <FaTheaterMasks size={12} /> {committee ? 'Salir Modo Comité' : 'Modo Comité'}
          </button>
          <button className="btn ghost" onClick={reset} style={{ fontSize: 11 }} disabled={running}>
            <FaRedoAlt size={11} /> Reproducir investigación
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
                  <><FaCheckCircle size={11} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--success)' }} /> {BITACORA.length} pasos completados</>
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
                <RiskScore score={score} variant="lg" sublabel={subLabel} />
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
                      <span
                        key={r.codigo}
                        className="chip red"
                        title={`Regla crítica del PDF del reto. ${r.nombre || ''}\n${r.evidencia || ''}`}
                      >
                        {r.codigo} · {r.nombre ? r.nombre.split(' ').slice(0, 3).join(' ') : 'regla crítica'}
                      </span>
                    ))}
                    {senales.slice(0, 4).map((s: any) => (
                      <span
                        key={s.id}
                        className="chip amber"
                        title={`Señal ponderada #${s.id} del catálogo. Suma ${s.puntos} pts al score.\n${s.evidencia || ''}`}
                      >
                        S{s.id} · {s.nombre ? s.nombre.split(' ').slice(0, 3).join(' ') : 'señal'} · +{s.puntos} pts
                      </span>
                    ))}
                    {detail.proveedor?.lista_restrictiva && (
                      <span className="chip red" title="Proveedor presente en la lista interna de Aseguradora del Sur por casos previos observados.">
                        proveedor en lista restrictiva
                      </span>
                    )}
                    {similares.length > 0 && (
                      <span className="chip blue" title="Casos con descripción muy similar detectados por embeddings text-embedding-3-large. Posible plagio narrativo.">
                        {similares.length} casos similares
                      </span>
                    )}
                  </div>

                  {/* Leyenda explicativa */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: '10px 12px',
                      background: 'var(--marfil-paper, #fdf8f1)',
                      border: '1px solid var(--line, #e6dfd1)',
                      borderRadius: 6,
                      fontSize: 11.5,
                      lineHeight: 1.5,
                      color: 'var(--ink-soft, #4a4a4a)',
                    }}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>¿Cómo leer estos chips?</strong>
                    <div style={{ marginTop: 4 }}>
                      <span className="chip red" style={{ fontSize: 9.5, padding: '1px 6px' }}>RF-XX</span>
                      {' = una de las 7 '}<em>reglas críticas</em>{' del manual antifraude (PDF del reto). Si se activa, el caso pasa automáticamente a ROJO o AMARILLO sin importar las señales.'}
                    </div>
                    <div style={{ marginTop: 3 }}>
                      <span className="chip amber" style={{ fontSize: 9.5, padding: '1px 6px' }}>SN +pts</span>
                      {' = una de las 14 '}<em>señales ponderadas</em>{' (frecuencia, monto, fechas, narrativa, documentos…). Cada una suma puntos al score 0–100.'}
                    </div>
                    <div style={{ marginTop: 3 }}>
                      <strong>Fórmula:</strong>{' score = max(suma de señales, mínimo forzado por reglas críticas).'}
                    </div>
                  </div>
                </div>
              </div>
            </ReportSection>
          )}

          {/* SECCIÓN VISUAL — desglose del score con barras animadas */}
          {showSummary && (
            <ReportSection n={2} title="Anatomía del score" sub={`cómo se construyó este ${score}/100 paso a paso`}>
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'var(--bg-card, #fff)',
                  border: '1px dashed var(--line, #e6dfd1)',
                  borderRadius: 6,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: 'var(--ink-soft, #4a4a4a)',
                }}
              >
                Cada señal activa <em>suma</em> puntos a un score que arranca en 0. Si <em>cualquier</em> regla crítica RF-01..04 se activa, el score se fuerza a ≥76 (ROJO); si se activa RF-05..07, mínimo 41 (AMARILLO). Mostramos cada componente para que decidás si el cálculo te convence.
              </div>
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
            <ReportSection n={3} title="Cómo se compara con la cartera" sub="benchmarks contra los 39.960 siniestros multi-ramo del dataset">
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'var(--bg-card, #fff)',
                  border: '1px dashed var(--line, #e6dfd1)',
                  borderRadius: 6,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: 'var(--ink-soft, #4a4a4a)',
                }}
              >
                Para entender si este caso es <em>raro</em>, lo comparamos contra el promedio y la mediana de la cartera completa. Una barra mucho más larga que el promedio es señal de anomalía (ej. monto muy alto, reporte muy tardío, demasiados reclamos previos).
              </div>
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
                    {reglas.map((r: any) => {
                      const key = `RULE:${r.codigo}`;
                      const isOpen = !!openExplain[key];
                      const explain = getRuleExplain(r.codigo);
                      return (
                        <div
                          key={r.codigo}
                          style={{
                            padding: '8px 12px',
                            background: 'rgba(197,51,58,0.06)',
                            borderRadius: 8,
                            border: '1px solid rgba(197,51,58,0.18)',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 10 }}>
                            <span className="mono chip red" style={{ fontSize: 10 }}>
                              {r.codigo}
                            </span>
                            <div style={{ flex: 1, fontSize: 12.5 }}>
                              <div style={{ fontWeight: 600 }}>{r.nombre}</div>
                              {r.evidencia && (
                                <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{r.evidencia}</div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                {r.clasificacion && (
                                  <span
                                    className={`chip mono ${
                                      r.clasificacion === 'ROJO' ? 'red' : 'amber'
                                    }`}
                                    style={{ fontSize: 9, display: 'inline-block' }}
                                  >
                                    fuerza {r.clasificacion}
                                  </span>
                                )}
                                {explain && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExplain(key)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      padding: 0,
                                      color: 'var(--rojo, #c5333a)',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      textDecoration: 'underline',
                                      textUnderlineOffset: 2,
                                    }}
                                    aria-expanded={isOpen}
                                  >
                                    {isOpen ? 'Ocultar detalle ▲' : '¿Qué significa? ▼'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          <ExplainPanel
                            open={isOpen}
                            data={explain}
                            tone={r.clasificacion === 'AMARILLO' ? 'amber' : 'red'}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {senales.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    Señales ponderadas (1..14)
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {senales.map((s: any) => {
                      const key = `SIGNAL:${s.id}`;
                      const isOpen = !!openExplain[key];
                      const explain = getSignalExplain(s.id);
                      return (
                        <div
                          key={s.id}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--marfil-paper)',
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-mute)' }}>
                              S{s.id}
                            </span>
                            <div style={{ flex: 1, fontSize: 12.5 }}>
                              {s.nombre}
                              {s.evidencia && (
                                <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{s.evidencia}</div>
                              )}
                              {explain && (
                                <button
                                  type="button"
                                  onClick={() => toggleExplain(key)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--amber-strong, #b8860b)',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    textUnderlineOffset: 2,
                                    marginTop: 2,
                                  }}
                                  aria-expanded={isOpen}
                                >
                                  {isOpen ? 'Ocultar detalle ▲' : '¿Qué significa? ▼'}
                                </button>
                              )}
                            </div>
                            <span className="chip amber mono" style={{ fontSize: 10 }}>
                              +{s.puntos}
                            </span>
                          </div>
                          <ExplainPanel open={isOpen} data={explain} tone="amber" />
                        </div>
                      );
                    })}
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
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: detail.n_documentos < 3 ? 'var(--warning-soft)' : 'var(--success-soft)',
                    color: detail.n_documentos < 3 ? 'var(--warning)' : 'var(--success)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <FaFileAlt size={26} />
                </div>
                <div>
                  <div className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {detail.n_documentos} documento{detail.n_documentos === 1 ? '' : 's'} en el expediente original
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    {detail.n_documentos < 3
                      ? <><FaExclamationTriangle size={11} style={{ color: 'var(--warning)' }} /> Cobertura documental por debajo del mínimo esperado (3+).</>
                      : <><FaCheckCircle size={11} style={{ color: 'var(--success)' }} /> Cobertura documental aceptable.</>}
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
                          <span style={{ color: tc, display: 'grid', placeItems: 'center' }}>
                            {d.tipo === 'factura' ? <FaFileInvoice size={16} /> : d.tipo === 'imagen_dano' ? <FaCamera size={16} /> : d.tipo === 'parte_policial' ? <FaCarCrash size={16} /> : <FaFileAlt size={16} />}
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
        setSent(`Registrado como "${decision}". Total feedbacks acumulados: ${d.total_feedbacks}.`);
      } else {
        setSent('El backend respondió sin OK. Revisa logs.');
      }
    } catch (e: any) {
      setSent(`Error: ${e?.message || e}`);
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
          color: 'var(--text-secondary)',
          padding: '10px 12px',
          background: 'var(--warning-soft)',
          borderRadius: 8,
          borderLeft: '3px solid var(--warning)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <FaExclamationTriangle size={13} style={{ color: 'var(--warning)' }} /> Esto es una recomendación generada por el cóndor. La decisión final es del analista humano.
      </div>

      <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          Tu decisión sobre {sid}
        </div>
        <textarea
          value={justif}
          onChange={(e) => setJustif(e.target.value)}
          placeholder="Justificación (opcional)…"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 10px',
            border: '1px solid var(--border-color)', borderRadius: 6,
            background: 'var(--bg-card-soft)', color: 'var(--text-primary)',
            fontSize: 12, fontFamily: 'inherit', resize: 'vertical', marginBottom: 10,
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn success" disabled={busy} onClick={() => decidir('aprobar')}>
            <FaCheckCircle size={12} /> Aprobar pago
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => decidir('retener')}>
            <FaExclamationTriangle size={12} /> Retener
          </button>
          <button className="btn danger" disabled={busy} onClick={() => decidir('bloquear')}>
            <FaBan size={12} /> Bloquear pago
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => decidir('escalar')}>
            <FaShareSquare size={12} /> Escalar a comité
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onBack}>
            <FaComments size={12} /> Volver al cóndor
          </button>
        </div>
        {sent && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: !sent.startsWith('Error') && !sent.startsWith('El backend') ? 'var(--success-soft)' : 'var(--danger-soft)',
              borderRadius: 6,
              fontSize: 11.5,
              color: !sent.startsWith('Error') && !sent.startsWith('El backend') ? 'var(--success)' : 'var(--danger)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {!sent.startsWith('Error') && !sent.startsWith('El backend') ? <FaCheckCircle size={12} /> : <FaExclamationTriangle size={12} />}
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
  const bg = b.flag === 'warn' ? 'var(--warning-soft)' : 'var(--bg-card)';
  const Icon = typeof b.icon === 'function' ? b.icon : null;
  return (
    <div
      className="fade-up"
      style={{
        borderLeft: `2px solid var(--${b.flag === 'warn' ? 'warning' : 'success'})`,
        paddingLeft: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          {b.t}
        </span>
        {Icon && <span style={{ color: b.flag === 'warn' ? 'var(--warning)' : 'var(--primary)', display: 'grid', placeItems: 'center' }}><Icon size={11} /></span>}
        {!latest && <FaCheckCircle size={10} style={{ color: 'var(--success)' }} />}
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
