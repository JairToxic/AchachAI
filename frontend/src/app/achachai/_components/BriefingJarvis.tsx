'use client';
// @ts-nocheck
/**
 * BriefingJarvis — Reporte ejecutivo estilo HUD oscuro.
 *
 * 3 momentos visuales:
 *  1) IDLE: card invitando a generar el briefing.
 *  2) STREAMING: bitácora del cóndor en vivo (tool_call → tool_result → delta).
 *     Estilo Jarvis Mark II: HUD oscuro, radar, chips de tools, texto que se escribe.
 *  3) DONE: reporte renderizado como secciones animadas (## → cards con icono).
 *     Debajo, chat conversacional para preguntar sobre el contenido.
 *
 * Backend: POST /reportes/ejecutivo/stream (NDJSON) + POST /chat/stream (NDJSON).
 */
import { useEffect, useRef, useState } from 'react';
import {
  FaBolt,
  FaBrain,
  FaCheckCircle,
  FaCog,
  FaCommentDots,
  FaFileAlt,
  FaLightbulb,
  FaPaperPlane,
  FaPlay,
  FaQuestionCircle,
  FaRedo,
  FaSyncAlt,
  FaTimes,
} from 'react-icons/fa';
import { TOOL_NARRATIVE } from './Chat';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/* ------------------------------------------------------------------ */
/* Iconos por sección del reporte (matchean los `## títulos` del prompt) */
/* ------------------------------------------------------------------ */
const SECTION_ICONS: { match: RegExp; icon: string; tone: string }[] = [
  { match: /pulso de la cartera/i, icon: '📊', tone: '#5BC0EB' },
  { match: /casos.*revisar primero/i, icon: '🎯', tone: '#E5523F' },
  { match: /proveedores.*acelerando/i, icon: '🏭', tone: '#E87A4F' },
  { match: /donde mirar|geograf/i, icon: '🗺️', tone: '#7BB661' },
  { match: /acciones concretas/i, icon: '⚡', tone: '#F4B942' },
  { match: /impacto econ/i, icon: '💰', tone: '#9D7AB8' },
];

function getSectionIcon(title: string) {
  for (const s of SECTION_ICONS) if (s.match.test(title)) return s;
  return { icon: '◆', tone: '#5BC0EB' };
}

/* ------------------------------------------------------------------ */
/* Parser markdown → secciones                                        */
/* ------------------------------------------------------------------ */
type Section = { title: string; body: string };

function parseSections(md: string): Section[] {
  if (!md) return [];
  const lines = md.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      if (current) sections.push(current);
      current = { title: h2[1].trim(), body: '' };
      continue;
    }
    if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) sections.push(current);
  return sections;
}

/* ------------------------------------------------------------------ */
/* Renderer minimalista de markdown inline (bold, italic, code)       */
/* y bloques (bullets, números, párrafos).                            */
/* ------------------------------------------------------------------ */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Orden: bold > italic > code > id_siniestro/id_proveedor.
  // Regex unificado: **bold**, *italic*, `code`, SIN-XXX, PRV-XXX.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|SIN-[A-Z0-9-]+|PRV-[A-Z0-9-]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(
        <strong key={key++} style={{ color: '#F5E9D5' }}>
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith('*')) {
      parts.push(
        <em key={key++} style={{ color: '#9FB5C9' }}>
          {tok.slice(1, -1)}
        </em>,
      );
    } else if (tok.startsWith('`')) {
      parts.push(
        <code
          key={key++}
          style={{
            background: 'rgba(91,192,235,0.12)',
            color: '#5BC0EB',
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (/^SIN-/.test(tok)) {
      parts.push(
        <span
          key={key++}
          style={{
            color: '#E5523F',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            padding: '1px 6px',
            background: 'rgba(229,82,63,0.10)',
            borderRadius: 4,
            border: '1px solid rgba(229,82,63,0.25)',
          }}
        >
          {tok}
        </span>,
      );
    } else if (/^PRV-/.test(tok)) {
      parts.push(
        <span
          key={key++}
          style={{
            color: '#E87A4F',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            padding: '1px 6px',
            background: 'rgba(232,122,79,0.10)',
            borderRadius: 4,
            border: '1px solid rgba(232,122,79,0.25)',
          }}
        >
          {tok}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderBlocks(body: string): React.ReactNode {
  const lines = body.split('\n').map((l) => l.trimEnd());
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuf.length) return;
    const Items = listBuf.map((it, i) => (
      <li key={i} style={{ marginBottom: 6, lineHeight: 1.6 }}>
        {renderInline(it)}
      </li>
    ));
    if (listType === 'ol') {
      out.push(
        <ol key={key++} style={{ margin: '8px 0 8px 22px', padding: 0, color: '#C8D5DF' }}>
          {Items}
        </ol>,
      );
    } else {
      out.push(
        <ul key={key++} style={{ margin: '8px 0 8px 22px', padding: 0, color: '#C8D5DF', listStyleType: 'none' }}>
          {listBuf.map((it, i) => (
            <li key={i} style={{ marginBottom: 6, lineHeight: 1.6, position: 'relative', paddingLeft: 16 }}>
              <span style={{ position: 'absolute', left: 0, color: '#5BC0EB' }}>▸</span>
              {renderInline(it)}
            </li>
          ))}
        </ul>,
      );
    }
    listBuf = [];
    listType = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushList();
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ol) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listBuf.push(ol[1]);
    } else if (ul) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listBuf.push(ul[1]);
    } else {
      flushList();
      out.push(
        <p key={key++} style={{ margin: '4px 0', lineHeight: 1.6, color: '#C8D5DF' }}>
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushList();
  return out;
}

/* ------------------------------------------------------------------ */
/* Sub-componentes                                                    */
/* ------------------------------------------------------------------ */
function RadarPulse({ active }: { active: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(91,192,235,0.18) 0%, rgba(91,192,235,0.04) 60%, transparent 100%)',
        border: '1.5px solid rgba(91,192,235,0.35)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(91,192,235,0.45) 60deg, transparent 90deg)',
          animation: active ? 'jarvis-sweep 1.6s linear infinite' : 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#5BC0EB',
          boxShadow: '0 0 12px #5BC0EB',
        }}
      />
      <style>{`@keyframes jarvis-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ToolChip({
  name,
  status,
}: {
  name: string;
  status: 'running' | 'done';
}) {
  const nar = TOOL_NARRATIVE[name] || { phrase: name, tone: '#5BC0EB', icon: FaBolt };
  const Icon = nar.icon || FaBolt;
  const tone = status === 'done' ? '#7BB661' : nar.tone || '#5BC0EB';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: `${tone}15`,
        border: `1px solid ${tone}50`,
        borderRadius: 999,
        fontSize: 11.5,
        color: tone,
        fontWeight: 600,
        marginRight: 6,
        marginBottom: 6,
        transition: 'all 0.3s ease',
      }}
    >
      {status === 'done' ? <FaCheckCircle size={11} /> : <Icon size={11} />}
      <span>{nar.phrase || name}</span>
      {status === 'running' && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: tone,
            animation: 'jarvis-blink 1s ease-in-out infinite',
          }}
        />
      )}
      <style>{`@keyframes jarvis-blink { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  );
}

function SectionCard({
  index,
  section,
  visible,
}: {
  index: number;
  section: Section;
  visible: boolean;
}) {
  const info = getSectionIcon(section.title);
  return (
    <div
      className={visible ? 'jarvis-fade-up' : ''}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.5s ease ${index * 90}ms, transform 0.5s ease ${index * 90}ms`,
        background:
          'linear-gradient(180deg, rgba(91,192,235,0.04) 0%, rgba(11,18,32,0.6) 100%)',
        border: `1px solid ${info.tone}30`,
        borderLeft: `3px solid ${info.tone}`,
        borderRadius: 12,
        padding: '18px 22px',
        marginBottom: 14,
        boxShadow: `0 0 24px ${info.tone}08`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${info.tone}1A`,
            border: `1px solid ${info.tone}40`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
          }}
        >
          {info.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: '.18em',
              color: info.tone,
              textTransform: 'uppercase',
              fontWeight: 700,
              opacity: 0.8,
            }}
          >
            §0{index + 1} · briefing
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#F5E9D5',
              fontFamily: 'Inter, system-ui, sans-serif',
              marginTop: 2,
            }}
          >
            {section.title}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: '#C8D5DF' }}>{renderBlocks(section.body)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat inline — preguntale al reporte                                */
/* ------------------------------------------------------------------ */
type ChatMsg = { role: 'user' | 'condor'; text: string; tools?: string[] };

const SUGGESTED: { label: string; q: string }[] = [
  { label: '¿Por qué priorizás los 3 primeros casos?', q: 'Explicame en detalle por qué priorizamos esos 3 casos en particular y qué señales pesaron más.' },
  { label: 'Plan de acción para esta semana', q: 'Dame un plan de acción específico, con responsable y deadline, para esta semana sobre los casos del briefing.' },
  { label: '¿Qué proveedores debería investigar?', q: '¿Cuáles son los proveedores con patrón más sospechoso ahora mismo y qué deberíamos pedirles?' },
  { label: '¿Cuánto podemos prevenir si actuamos hoy?', q: 'Simulá el ahorro si bloqueamos hoy todos los casos ROJOS del briefing. Dame número en USD y supuestos.' },
];

function ReportChat({ reportContext }: { reportContext: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, phase]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    setPhase('Preparando contexto…');

    // El contexto del reporte va inyectado como mensaje previo de "assistant"
    // para que el agente sepa de qué le están preguntando.
    const contextMsg = {
      role: 'assistant',
      content:
        'Acabo de presentar este reporte ejecutivo al analista. Voy a responder preguntas sobre él:\n\n' +
        reportContext,
    };
    const historyForApi = [
      contextMsg,
      ...msgs.slice(-6).map((m) => ({
        role: m.role === 'condor' ? 'assistant' : 'user',
        content: m.text,
      })),
    ];

    let answer = '';
    const toolsCalled: string[] = [];
    let pushed = false;
    try {
      const resp = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history: historyForApi }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: any;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === 'tool_call') {
            toolsCalled.push(ev.tool);
            const nar = TOOL_NARRATIVE[ev.tool];
            setPhase(nar ? `${nar.phrase}…` : `Consultando ${ev.tool}…`);
          } else if (ev.type === 'delta') {
            answer += ev.text || '';
            if (!pushed) {
              pushed = true;
              setPhase('');
              setMsgs((m) => [...m, { role: 'condor', text: answer, tools: toolsCalled }]);
            } else {
              setMsgs((m) => {
                const cp = m.slice();
                const last = cp[cp.length - 1];
                if (last && last.role === 'condor') {
                  cp[cp.length - 1] = { ...last, text: answer, tools: toolsCalled };
                }
                return cp;
              });
            }
          } else if (ev.type === 'done') {
            if (!pushed && answer.trim()) {
              setMsgs((m) => [...m, { role: 'condor', text: answer, tools: toolsCalled }]);
            }
          } else if (ev.type === 'error') {
            setMsgs((m) => [...m, { role: 'condor', text: `⚠️ ${ev.message}` }]);
          }
        }
      }
    } catch (e: any) {
      setMsgs((m) => [...m, { role: 'condor', text: `⚠️ ${e?.message || e}` }]);
    } finally {
      setBusy(false);
      setPhase('');
    }
  }

  return (
    <div
      style={{
        marginTop: 22,
        background: 'rgba(11,18,32,0.65)',
        border: '1px solid rgba(91,192,235,0.25)',
        borderRadius: 14,
        padding: 18,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <FaCommentDots size={14} color="#5BC0EB" />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '.18em',
              color: '#5BC0EB',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Preguntale al cóndor sobre este briefing
          </div>
          <div style={{ fontSize: 12.5, color: '#9FB5C9', marginTop: 2 }}>
            El agente recuerda lo que acaba de informar. Profundizá, desafiá supuestos, pedile acciones.
          </div>
        </div>
        {msgs.length > 0 && (
          <button
            type="button"
            onClick={() => setMsgs([])}
            disabled={busy}
            title="Limpiar conversación"
            style={{
              background: 'transparent',
              color: '#9FB5C9',
              border: '1px solid rgba(159,181,201,0.3)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FaTimes size={9} /> Limpiar
          </button>
        )}
      </div>

      {/* Sugerencias */}
      {msgs.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {SUGGESTED.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => ask(s.q)}
              disabled={busy}
              style={{
                background: 'rgba(91,192,235,0.08)',
                border: '1px solid rgba(91,192,235,0.3)',
                color: '#5BC0EB',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 11.5,
                cursor: busy ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
              }}
            >
              <FaLightbulb size={10} /> {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Conversación */}
      {msgs.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            marginBottom: 12,
            display: 'grid',
            gap: 10,
            padding: 4,
          }}
        >
          {msgs.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background:
                  m.role === 'user'
                    ? 'rgba(91,192,235,0.12)'
                    : 'rgba(245,233,213,0.04)',
                border: `1px solid ${m.role === 'user' ? 'rgba(91,192,235,0.3)' : 'rgba(245,233,213,0.12)'}`,
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.55,
                color: m.role === 'user' ? '#C8E8F5' : '#E8DCC4',
                maxWidth: '92%',
                marginLeft: m.role === 'user' ? 'auto' : 0,
              }}
            >
              {m.role === 'condor' && m.tools && m.tools.length > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#7BB661',
                    marginBottom: 6,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  ◇ Consultó: {m.tools.join(' · ')}
                </div>
              )}
              <div>{renderBlocks(m.text)}</div>
            </div>
          ))}
          {phase && (
            <div
              style={{
                fontSize: 12,
                color: '#5BC0EB',
                fontStyle: 'italic',
                padding: '6px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FaSyncAlt size={10} style={{ animation: 'jarvis-spin 1s linear infinite' }} /> {phase}
              <style>{`@keyframes jarvis-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? 'El cóndor está pensando…' : 'Preguntá lo que quieras sobre este briefing…'}
          disabled={busy}
          style={{
            flex: 1,
            background: 'rgba(11,18,32,0.8)',
            border: '1px solid rgba(91,192,235,0.3)',
            borderRadius: 8,
            color: '#F5E9D5',
            padding: '10px 14px',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            background: busy || !input.trim() ? 'rgba(91,192,235,0.2)' : '#5BC0EB',
            color: busy || !input.trim() ? '#5BC0EB' : '#0B1220',
            border: 'none',
            borderRadius: 8,
            padding: '0 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FaPaperPlane size={11} /> Enviar
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Componente principal                                               */
/* ------------------------------------------------------------------ */
type Status = 'idle' | 'streaming' | 'done' | 'error';

export function BriefingJarvis() {
  const [status, setStatus] = useState<Status>('idle');
  const [text, setText] = useState('');
  const [tools, setTools] = useState<{ name: string; status: 'running' | 'done' }[]>([]);
  const [currentPhase, setCurrentPhase] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [tokensIn, setTokensIn] = useState(0);

  const sections = parseSections(text);

  async function generar() {
    setStatus('streaming');
    setText('');
    setTools([]);
    setCurrentPhase('Conectando con el cóndor…');
    setErrMsg('');

    try {
      const resp = await fetch(`${API}/reportes/ejecutivo/stream`, { method: 'POST' });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: any;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === 'tool_call') {
            const nar = TOOL_NARRATIVE[ev.tool];
            setCurrentPhase(nar ? `${nar.phrase}…` : `Llamando ${ev.tool}…`);
            setTools((t) => [...t, { name: ev.tool, status: 'running' }]);
          } else if (ev.type === 'tool_result') {
            setTools((t) =>
              t.map((x, i) => (i === t.length - 1 && x.name === ev.tool ? { ...x, status: 'done' as const } : x)),
            );
          } else if (ev.type === 'delta') {
            acc += ev.text || '';
            setText(acc);
            setCurrentPhase('Redactando briefing…');
          } else if (ev.type === 'done') {
            setTokensIn(ev.tokens || 0);
            setStatus('done');
            setCurrentPhase('');
            setTools((t) => t.map((x) => ({ ...x, status: 'done' as const })));
          } else if (ev.type === 'error') {
            throw new Error(ev.message);
          }
        }
      }
      if (!acc) {
        setStatus('error');
        setErrMsg('El cóndor no devolvió contenido.');
      }
    } catch (e: any) {
      setStatus('error');
      setErrMsg(e?.message || String(e));
      setCurrentPhase('');
    }
  }

  return (
    <div
      style={{
        background:
          'radial-gradient(ellipse at top, #15243d 0%, #0B1220 70%, #060B17 100%)',
        borderRadius: 16,
        padding: 22,
        border: '1px solid rgba(91,192,235,0.18)',
        boxShadow:
          '0 0 0 1px rgba(91,192,235,0.04), 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,233,213,0.04)',
        color: '#F5E9D5',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grid HUD de fondo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(91,192,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(91,192,235,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      />

      {/* Header */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 16,
        }}
      >
        <RadarPulse active={status === 'streaming'} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '.24em',
              color: '#5BC0EB',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            AchachAI · briefing en vivo
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#F5E9D5',
              fontFamily: 'Inter, system-ui, sans-serif',
              marginTop: 2,
            }}
          >
            El cóndor te informa
          </div>
          <div style={{ fontSize: 11.5, color: '#9FB5C9', marginTop: 4 }}>
            {status === 'idle' && 'Listo para volar sobre los 39.960 siniestros y traerte un briefing ejecutivo.'}
            {status === 'streaming' && (currentPhase || 'Procesando…')}
            {status === 'done' &&
              `Briefing completo · ${sections.length} secciones · ${tools.length} herramientas usadas${
                tokensIn ? ` · ${tokensIn} tokens` : ''
              }`}
            {status === 'error' && `⚠️ ${errMsg}`}
          </div>
        </div>
        <button
          type="button"
          onClick={generar}
          disabled={status === 'streaming'}
          style={{
            background:
              status === 'streaming'
                ? 'rgba(91,192,235,0.15)'
                : 'linear-gradient(135deg, #5BC0EB 0%, #4A9BC4 100%)',
            color: status === 'streaming' ? '#5BC0EB' : '#0B1220',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: status === 'streaming' ? 'wait' : 'pointer',
            boxShadow: status === 'streaming' ? 'none' : '0 4px 18px rgba(91,192,235,0.4)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            letterSpacing: '.02em',
          }}
        >
          {status === 'idle' && (
            <>
              <FaPlay size={11} /> Generar briefing
            </>
          )}
          {status === 'streaming' && (
            <>
              <FaSyncAlt size={11} style={{ animation: 'jarvis-spin 1s linear infinite' }} /> En vuelo…
            </>
          )}
          {status === 'done' && (
            <>
              <FaRedo size={11} /> Regenerar
            </>
          )}
          {status === 'error' && (
            <>
              <FaRedo size={11} /> Reintentar
            </>
          )}
        </button>
      </div>

      {/* Bitácora de tools (solo durante streaming + al terminar) */}
      {(status === 'streaming' || status === 'done') && tools.length > 0 && (
        <div
          style={{
            position: 'relative',
            padding: '10px 14px',
            background: 'rgba(11,18,32,0.7)',
            border: '1px solid rgba(91,192,235,0.18)',
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: '.18em',
              color: '#7BB661',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            ◇ Bitácora · herramientas consultadas
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {tools.map((t, i) => (
              <ToolChip key={`${t.name}-${i}`} name={t.name} status={t.status} />
            ))}
          </div>
        </div>
      )}

      {/* Estado IDLE: invitación */}
      {status === 'idle' && (
        <div
          style={{
            position: 'relative',
            padding: '28px 24px',
            background: 'rgba(11,18,32,0.5)',
            borderRadius: 12,
            border: '1px dashed rgba(91,192,235,0.25)',
            textAlign: 'center',
          }}
        >
          <FaBrain size={32} color="#5BC0EB" style={{ marginBottom: 12, opacity: 0.7 }} />
          <div style={{ fontSize: 14, color: '#C8D5DF', marginBottom: 6, fontWeight: 500 }}>
            El cóndor está esperando órdenes.
          </div>
          <div style={{ fontSize: 12, color: '#7A8FA3', lineHeight: 1.55, maxWidth: 480, margin: '0 auto' }}>
            Tocá <strong style={{ color: '#5BC0EB' }}>Generar briefing</strong> para que consulte las 9 herramientas y
            redacte el reporte ejecutivo en vivo. Vas a ver qué está mirando, qué está calculando, y al final podés
            hacerle preguntas conversacionales.
          </div>
        </div>
      )}

      {/* Estado STREAMING sin secciones aún: cursor de espera */}
      {status === 'streaming' && sections.length === 0 && (
        <div
          style={{
            position: 'relative',
            padding: '28px 24px',
            background: 'rgba(11,18,32,0.5)',
            borderRadius: 12,
            border: '1px solid rgba(91,192,235,0.18)',
            textAlign: 'center',
          }}
        >
          <FaCog
            size={28}
            color="#5BC0EB"
            style={{ marginBottom: 10, animation: 'jarvis-spin 2.4s linear infinite' }}
          />
          <div style={{ fontSize: 13, color: '#C8D5DF', fontWeight: 500 }}>
            {currentPhase || 'El cóndor está leyendo la cartera…'}
          </div>
          <div style={{ fontSize: 11, color: '#7A8FA3', marginTop: 4 }}>
            En segundos vas a ver cómo se construye sección por sección.
          </div>
        </div>
      )}

      {/* Secciones del briefing */}
      {sections.length > 0 && (
        <div style={{ position: 'relative' }}>
          {sections.map((s, i) => (
            <SectionCard key={`${i}-${s.title}`} index={i} section={s} visible={true} />
          ))}
        </div>
      )}

      {/* Chat: solo cuando el briefing terminó */}
      {status === 'done' && text && <ReportChat reportContext={text} />}

      <style>{`
        .jarvis-fade-up { animation: jarvis-fadeup 0.5s ease forwards; }
        @keyframes jarvis-fadeup {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default BriefingJarvis;
