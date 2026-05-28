'use client';
// @ts-nocheck
/**
 * Agente flotante GLOBAL.
 *
 * Expone:
 *   <AgentProvider onNavigate={...}>...</AgentProvider>   (envuelve toda la app)
 *   useAgent()                  -> { openAgent, closeAgent, setScreenContext, ... }
 *   useScreenContext(s)         -> hook util para que cada Screen registre su contexto
 *   <AgentDrawer/>              -> el panel lateral (montar 1 vez en el layout)
 *
 * El drawer:
 *   - Recibe contexto automatico de la pantalla actual (mostrado en la cabecera)
 *   - Permite abrirse con un prompt pre-cargado (botones contextuales)
 *   - Inyecta el contexto al mensaje que se manda al backend (asi el agente sabe
 *     desde donde se le pregunta, sin que el usuario tenga que escribirlo)
 *   - Renderiza la misma evidencia visual que el ChatScreen full (cards de casos,
 *     mapa Ecuador, PDF download, evaluacion) y cuando se hace click en un caso
 *     dispara onNavigate -> page.tsx cambia de pantalla y cierra el drawer.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Condor } from './Condor';
import {
  MD, EvidencePreview, JarvisStream, CityHeatmapAuto,
  ReportePdfCard, EvaluacionCard, TOOL_NARRATIVE,
} from './Chat';

// =====================================================================
//  TYPES
// =====================================================================
export type AgentNavAction =
  | { type: 'investigate'; id: string }
  | { type: 'verAsegurado'; id: string }
  | { type: 'goto'; screen: string };

export interface ScreenContext {
  screen: string;
  label: string;
  hint?: string;          // descripcion breve que se inyecta al prompt del LLM
  payload?: any;
  prompts?: string[];     // sugerencias contextuales que mostrar bajo el input
}

interface AgentCtxValue {
  open: boolean;
  openAgent: (opts?: { prompt?: string }) => void;
  closeAgent: () => void;
  toggleAgent: () => void;
  screenContext: ScreenContext | null;
  setScreenContext: (c: ScreenContext | null) => void;
  pendingPrompt: string | null;
  consumePendingPrompt: () => string | null;
  emitNavigate: (a: AgentNavAction) => void;
}

const Ctx = createContext<AgentCtxValue | null>(null);

// =====================================================================
//  PROVIDER
// =====================================================================
export function AgentProvider({
  children,
  onNavigate,
}: {
  children: React.ReactNode;
  onNavigate: (a: AgentNavAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [screenContext, setScreenContext] = useState<ScreenContext | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const openAgent = useCallback((opts?: { prompt?: string }) => {
    if (opts?.prompt) setPendingPrompt(opts.prompt);
    setOpen(true);
  }, []);
  const closeAgent = useCallback(() => setOpen(false), []);
  const toggleAgent = useCallback(() => setOpen(o => !o), []);

  const consumePendingPrompt = useCallback(() => {
    const p = pendingPrompt;
    setPendingPrompt(null);
    return p;
  }, [pendingPrompt]);

  const emitNavigate = useCallback((a: AgentNavAction) => {
    onNavigate(a);
    setOpen(false); // al navegar, cerramos el drawer
  }, [onNavigate]);

  const value = useMemo(
    () => ({ open, openAgent, closeAgent, toggleAgent, screenContext, setScreenContext, pendingPrompt, consumePendingPrompt, emitNavigate }),
    [open, openAgent, closeAgent, toggleAgent, screenContext, pendingPrompt, consumePendingPrompt, emitNavigate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAgent(): AgentCtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAgent debe usarse dentro de <AgentProvider>');
  return v;
}

/** Hook util: cada Screen lo llama para registrar su contexto. */
export function useRegisterScreenContext(ctx: ScreenContext | null) {
  const { setScreenContext } = useAgent();
  useEffect(() => {
    setScreenContext(ctx);
    return () => setScreenContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.screen, ctx?.label, JSON.stringify(ctx?.payload || {})]);
}

// =====================================================================
//  FAB GLOBAL (boton flotante)
// =====================================================================
export function AgentFAB({ mood = 'idle', message }: { mood?: any; message?: string | null }) {
  const { openAgent, open } = useAgent();
  const [showMsg, setShowMsg] = useState(false);

  useEffect(() => {
    if (message && !open) {
      setShowMsg(true);
      const t = setTimeout(() => setShowMsg(false), 9000);
      return () => clearTimeout(t);
    }
  }, [message, open]);

  if (open) return null; // ocultamos el FAB cuando el drawer esta abierto

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 80,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
    }}>
      {showMsg && message && (
        <div className="fade-up" style={{
          maxWidth: 280, background: 'white', border: '1px solid var(--line)',
          padding: '10px 14px', borderRadius: 14, boxShadow: 'var(--shadow-lg)',
          fontSize: 12.5, color: 'var(--condor-wing)', position: 'relative',
        }}>
          <div style={{
            fontSize: 10, color: 'var(--andes-orange)', fontWeight: 600,
            marginBottom: 4, letterSpacing: '.08em',
          }}>EL CÓNDOR DICE</div>
          {message}
          <div style={{
            position: 'absolute', bottom: -6, right: 24, width: 12, height: 12,
            background: 'white', borderRight: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)', transform: 'rotate(45deg)',
          }}/>
        </div>
      )}
      <button
        onClick={() => openAgent()}
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: mood === 'alert'
            ? 'linear-gradient(135deg, #C5333A, #7A1F25)'
            : 'linear-gradient(135deg, var(--mountain-blue), var(--condor-wing))',
          border: '3px solid var(--marfil-paper)', boxShadow: 'var(--shadow-lg)',
          display: 'grid', placeItems: 'center', color: 'var(--marfil)', position: 'relative',
          animation: mood === 'alert' ? 'pulse-red 1.2s infinite' : 'none',
          cursor: 'pointer',
        }}
        aria-label="Hablar con el cóndor"
      >
        <Condor size={40} tone="marfil" mood={mood}/>
        {mood === 'alert' && (
          <span style={{
            position: 'absolute', top: -4, right: -4, width: 14, height: 14,
            borderRadius: '50%', background: 'var(--guayaba-red)',
            border: '2px solid var(--marfil-paper)',
          }}/>
        )}
      </button>
    </div>
  );
}

// =====================================================================
//  PROMPTS contextuales por pantalla
// =====================================================================
const CONTEXT_PROMPTS: Record<string, string[]> = {
  home:          ['Mostrame los 10 casos más críticos de hoy', 'Resumime mi cartera', '¿Hay patrones nuevos esta semana?'],
  kanban:        ['Priorizá los pendientes de mi bandeja', '¿Cuál debería resolver primero?', 'Marcame los que tienen documentación incompleta'],
  explorar:      ['Encontrá casos con monto > $50K', 'Filtrame por sucursal Guayaquil rojos', '¿Cuáles son los más viejos sin resolver?'],
  investigation: ['Explicame por qué este caso está en rojo', '¿Qué documentos faltan acá?', 'Compará con casos similares del mismo proveedor'],
  asegurado:     ['Resumime el historial de este asegurado', '¿Tiene patrón de reclamos sospechoso?', 'Mostrame otros casos suyos'],
  evaluar:       ['Evaluá un robo de $20K con 10 días de reporte tardío', '¿Qué pasa si subo el monto a $40K?', 'Simulá con proveedor en lista restrictiva'],
  prevencion:    ['¿Qué patrones se repiten en los rojos recientes?', 'Top 5 proveedores con más alertas', 'Ciudades con mayor concentración'],
  anomalias:     ['¿Qué casos raros aparecieron que aún no marqué?', 'Patrones que el modelo supervisado no ve', 'Anomalías por sucursal'],
  documents:     ['Explicame qué señales tiene esta factura', '¿La foto del daño coincide con la descripción?', 'Inconsistencias en este expediente'],
  tejido:        ['Mostrame la red del proveedor más conectado', '¿Qué asegurados comparten proveedor?', 'Conexiones sospechosas en la red'],
  reports:       ['Generame el reporte ejecutivo de hoy', 'PDF para el comité antifraude', 'Reporte de auditoría SBS'],
  ajustes:       ['¿Cuál es la alineación actual del modelo?', 'Muéstrame fairness por sucursal', '¿Cuándo fue el último reentreno?'],
  cargar:        ['¿Cómo cargo casos nuevos por CSV?', 'Evaluá este caso recién cargado', 'Plantilla para cargar masivo'],
  chat:          ['Mostrame los 10 casos más críticos', '¿Qué proveedores concentran alertas?', 'Generar reporte ejecutivo'],
};

// =====================================================================
//  DRAWER
// =====================================================================
export function AgentDrawer({ role = 'antifraude' }: { role?: string }) {
  const { open, closeAgent, screenContext, consumePendingPrompt, emitNavigate } = useAgent();

  // Estado del chat (vive aca, persiste mientras el drawer esta montado)
  const [messages, setMessages] = useState<any[]>([{
    role: 'condor', kind: 'greeting',
    text: 'Estoy planeando junto a vos. Preguntame cualquier cosa sobre lo que ves en pantalla.',
    time: nowHHMM(),
  }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Cuando se abre con un prompt pre-cargado, lo enviamos automaticamente
  useEffect(() => {
    if (!open) return;
    const p = consumePendingPrompt();
    if (p) {
      // pequeño delay para que el drawer termine de abrirse
      const t = setTimeout(() => send(p), 180);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll al fondo
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, thinking, activeTools]);

  const ctxPrompts = (screenContext?.prompts && screenContext.prompts.length > 0)
    ? screenContext.prompts
    : (screenContext && CONTEXT_PROMPTS[screenContext.screen]) || CONTEXT_PROMPTS.home;

  function send(text?: string) {
    const q = (text || input).trim();
    if (!q) return;
    setMessages(m => [...m, { role: 'user', text: q, time: nowHHMM() }]);
    setInput('');
    runAgent(q);
  }

  async function runAgent(q: string) {
    const API = (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_API_URL) || 'http://localhost:8000';
    setThinking(true);
    setActiveTools([]);
    setCurrentTool(null);

    setCurrentPhase('🛫 Conectando con Azure AI Foundry…');
    await sleep(280);
    setCurrentPhase('🧠 Resolviendo intención · eligiendo tools…');
    await sleep(320);

    // Inyectar contexto de pantalla actual ANTES del mensaje del usuario.
    // El backend recibe esto como user message, asi el agente sabe desde donde se le habla.
    const ctxHint = buildContextHint(screenContext, role);
    const messageToBackend = ctxHint ? `${ctxHint}\n\n${q}` : q;

    const history = messages
      .filter(m => m.text || (m.payload && m.payload.summary))
      .slice(-6)
      .map(m => ({
        role: m.role === 'condor' ? 'assistant' : 'user',
        content: m.text || (m.payload && m.payload.summary) || '',
      }));

    setCurrentPhase('📡 Consultando base de 25.460 siniestros…');

    try {
      const resp = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToBackend, history }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const tools: string[] = (data.tools_used || []).map((t: any) => t.tool);

      for (let i = 0; i < tools.length; i++) {
        const nar = TOOL_NARRATIVE[tools[i]] || { phrase: tools[i] };
        setCurrentPhase(`${nar.phrase}…`);
        setCurrentTool(tools[i]);
        setActiveTools(t => [...t, tools[i]]);
        await sleep(380 + Math.random() * 180);
      }

      setCurrentTool(null);
      setCurrentPhase('✨ Sintetizando insights…');
      await sleep(400);

      setThinking(false);
      setActiveTools([]);
      setCurrentPhase('');

      const toolsFull = data.tools_used || [];
      const reporteResult = toolsFull.find((t: any) => t.tool === 'generar_reporte_pdf' && t.result_full)?.result_full;
      const evaluacionResult = toolsFull.find((t: any) => t.tool === 'evaluar_caso_hipotetico' && t.result_full)?.result_full;

      const payload = {
        summary: data.response || 'Sin respuesta.',
        tools,
        sources: tools.map((t: string) => {
          const nar = TOOL_NARRATIVE[t];
          return nar ? `${nar.icon} ${nar.phrase} (${t})` : `Llamé tool '${t}'`;
        }),
        cost: {
          tokens: data.tokens || 0,
          time: `${data.iterations || 1} it`,
          price: `~$${((data.tokens || 0) * 0.000002).toFixed(4)}`,
        },
        reporteResult,
        evaluacionResult,
      };
      setMessages(m => [...m, { role: 'condor', kind: 'answer', payload, time: nowHHMM() }]);
    } catch (err: any) {
      setThinking(false);
      setActiveTools([]);
      setCurrentPhase('');
      setCurrentTool(null);
      setMessages(m => [...m, {
        role: 'condor', kind: 'answer',
        payload: {
          summary: `⚠️ Error consultando al backend: \`${err?.message || err}\`. Verificá que FastAPI esté en \`localhost:8000\`.`,
          tools: [], sources: [], cost: { tokens: 0, time: '0s', price: '$0' },
        },
        time: nowHHMM(),
      }]);
    }
  }

  // Handler que se pasa a EvidencePreview/EvaluacionCard. Al hacer click en
  // un SIN-XXX dentro del chat, navegamos a Investigation y cerramos drawer.
  const handleInvestigate = useCallback((id: string) => {
    emitNavigate({ type: 'investigate', id });
  }, [emitNavigate]);

  return (
    <>
      {/* Backdrop semitransparente */}
      <div
        onClick={closeAgent}
        style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(15, 36, 54, 0.32)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .25s ease',
        }}
      />

      {/* Drawer panel */}
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(520px, 92vw)',
          zIndex: 91,
          background: 'var(--marfil)',
          borderLeft: '1px solid var(--line)',
          boxShadow: '-12px 0 40px rgba(15,36,54,0.18)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .28s cubic-bezier(.22,.61,.36,1)',
        }}
      >
        {/* Header con cierre + indicador de contexto */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          background: 'linear-gradient(180deg, var(--marfil-paper), var(--marfil))',
          borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ position: 'relative' }}>
            <Condor size={36} tone="wing" mood={thinking ? 'think' : 'idle'} />
            <span style={{
              position: 'absolute', bottom: 0, right: -1, width: 8, height: 8,
              borderRadius: '50%', background: 'var(--paramo-green)',
              border: '2px solid var(--marfil)',
            }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--condor-wing)' }}>
              Cóndor · copiloto
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {screenContext?.label
                ? <>📍 viendo: <strong style={{ color: 'var(--mountain-blue)' }}>{screenContext.label}</strong></>
                : <>📍 vista general</>}
            </div>
          </div>
          <button
            onClick={closeAgent}
            aria-label="Cerrar"
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)',
              background: 'white', cursor: 'pointer', fontSize: 16, color: 'var(--ink-soft)',
              display: 'grid', placeItems: 'center',
            }}
          >✕</button>
        </header>

        {/* Mensajes */}
        <div
          ref={scrollerRef as any}
          style={{ flex: 1, overflow: 'auto', padding: '14px 16px 8px' }}
        >
          {messages.map((m, i) => <DrawerMessage key={i} msg={m} onInvestigate={handleInvestigate} />)}
          {thinking && <JarvisStream phase={currentPhase} tools={activeTools} currentTool={currentTool || undefined} />}
        </div>

        {/* Sugerencias contextuales + input */}
        <div style={{
          borderTop: '1px solid var(--line)',
          padding: '10px 14px 14px',
          background: 'var(--marfil-paper)',
        }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {ctxPrompts.slice(0, 4).map((p, i) => (
              <button
                key={i}
                onClick={() => send(p)}
                disabled={thinking}
                className="chip outline"
                style={{
                  cursor: thinking ? 'not-allowed' : 'pointer',
                  fontSize: 11, padding: '5px 10px',
                  background: 'white', opacity: thinking ? 0.5 : 1,
                }}
              >{p}</button>
            ))}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'white', border: '1px solid var(--line-strong)',
            borderRadius: 14, padding: '6px 6px 6px 14px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Condor size={18} tone="orange" mood="idle" />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !thinking && send()}
              placeholder={
                screenContext
                  ? `Preguntá sobre ${screenContext.label.toLowerCase()}…`
                  : 'Preguntale al cóndor…'
              }
              style={{
                flex: 1, border: 0, outline: 0, fontSize: 13, padding: '8px 0',
                background: 'transparent', color: 'var(--condor-wing)',
              }}
            />
            <button
              className="btn"
              onClick={() => send()}
              disabled={thinking}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              {thinking ? '…' : 'Enviar →'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// =====================================================================
//  HELPERS
// =====================================================================
function buildContextHint(ctx: ScreenContext | null, role: string): string {
  if (!ctx) return `[Contexto del usuario: rol ${role}]`;
  const lines = [
    `[Contexto del usuario: rol ${role}, pantalla actual: ${ctx.label}]`,
  ];
  if (ctx.hint) lines.push(`[${ctx.hint}]`);
  if (ctx.payload?.caseId) lines.push(`[caso enfocado: ${ctx.payload.caseId}]`);
  if (ctx.payload?.aseguradoId) lines.push(`[asegurado enfocado: ${ctx.payload.aseguradoId}]`);
  return lines.join(' ');
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// =====================================================================
//  MESSAGE (version drawer-compacta — usa los helpers exportados del Chat)
// =====================================================================
function DrawerMessage({ msg, onInvestigate }: { msg: any; onInvestigate: (id: string) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="fade-up" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{
          maxWidth: '85%', padding: '9px 14px',
          borderRadius: '14px 14px 4px 14px',
          background: 'var(--condor-wing)', color: 'var(--marfil)',
          fontSize: 13, lineHeight: 1.45,
        }}>
          {msg.text}
          <div style={{ fontSize: 9.5, opacity: 0.55, textAlign: 'right', marginTop: 3 }}>{msg.time}</div>
        </div>
      </div>
    );
  }

  if (msg.kind === 'answer') {
    const a = msg.payload;
    return (
      <div className="fade-up" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Condor size={22} mood="speak" tone="wing" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            background: 'white', border: '1px solid var(--line)',
            borderRadius: '4px 14px 14px 14px', overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ padding: '12px 14px 4px' }}>
              <MD>{a.summary}</MD>
            </div>

            <EvidencePreview summary={a.summary} onInvestigate={onInvestigate} />

            {a.tools?.includes('ranking_ciudades') && <CityHeatmapAuto />}
            {a.reporteResult && <ReportePdfCard r={a.reporteResult} />}
            {a.evaluacionResult && <EvaluacionCard e={a.evaluacionResult} onInvestigate={onInvestigate} />}

            <details style={{
              borderTop: '1px solid var(--line)', padding: '8px 14px',
              background: 'var(--marfil-paper)', fontSize: 11,
            }}>
              <summary style={{
                cursor: 'pointer', fontSize: 11, color: 'var(--mountain-blue)', fontWeight: 600,
              }}>▾ ¿Cómo lo resolví?</summary>
              <ul style={{ margin: '6px 0 4px 14px', padding: 0, fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {a.sources.map((s: string, i: number) => <li key={i}>⚡ {s}</li>)}
              </ul>
              <div style={{
                display: 'flex', gap: 10, fontSize: 10, color: 'var(--ink-mute)',
                marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--line)', flexWrap: 'wrap',
              }}>
                <span>⏱ {a.cost.time}</span>
                <span>🪙 {a.cost.tokens} tk</span>
                <span>💵 {a.cost.price}</span>
                {a.tools.length > 0 && (
                  <span style={{ flexBasis: '100%', marginTop: 4 }}>
                    🔧 {a.tools.map((t: string) => <span key={t} className="mono" style={{ marginRight: 4 }}>[{t}]</span>)}
                  </span>
                )}
              </div>
            </details>
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 3 }}>{msg.time}</div>
        </div>
      </div>
    );
  }

  // greeting / proactive
  return (
    <div className="fade-up" style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
      <Condor size={22} mood="idle" tone="wing" />
      <div style={{
        flex: 1, background: 'white', border: '1px solid var(--line)',
        padding: '10px 14px', borderRadius: '4px 14px 14px 14px',
        fontSize: 13, lineHeight: 1.5, boxShadow: 'var(--shadow-sm)',
      }}>
        {msg.text}
        <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 3 }}>{msg.time}</div>
      </div>
    </div>
  );
}
