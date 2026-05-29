'use client';
// @ts-nocheck
/**
 * Cóndor Profesor — burbuja flotante con el cóndor preguntando
 * "¿Querés que te explique?". Al hacer click, abre el AgentDrawer
 * con un prompt contextual rico (incluye datos REALES de la pantalla).
 *
 * Uso:
 *   <CondorTeacher
 *     screen="red-relaciones"
 *     title="¿Querés que te explique la red?"
 *     hook="Hay 30 proveedores y 99 conexiones en pantalla — puedo guiarte."
 *     contextPrompt={`Estamos en la pantalla de Red de Relaciones... [datos reales]`}
 *   />
 *
 * Se posiciona arriba a la derecha del contenido. Persistente: una vez
 * descartada en una pantalla, no vuelve a aparecer en esa sesion.
 */
import { useEffect, useState } from 'react';
import { FaTimes, FaGraduationCap } from 'react-icons/fa';
import { CondorLogo } from './CondorLogo';
import { useAgent } from './AgentDrawer';

type Props = {
  screen: string;          // identificador unico de la pantalla (para dismiss persistente)
  title?: string;          // titulo de la burbuja
  hook?: string;           // texto del enganche
  contextPrompt: string;   // prompt que se manda al cóndor con datos reales
  position?: 'tr' | 'br' | 'inline'; // top-right, bottom-right, inline
};

export function CondorTeacher({
  screen,
  title = '¿Querés que te explique esta pantalla?',
  hook = 'Te puedo guiar paso a paso con los datos que estás viendo.',
  contextPrompt,
  position = 'tr',
}: Props) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const agent = useAgent();

  // Aparecer despues de un pequeño delay (que el usuario vea la pantalla primero)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Sesion-only: usar sessionStorage en vez de localStorage
    try {
      const key = `achachai-teacher-dismissed-${screen}`;
      if (sessionStorage.getItem(key) === '1') {
        setDismissed(true);
        return;
      }
    } catch {}
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, [screen]);

  function dismiss() {
    setShow(false);
    setDismissed(true);
    try { sessionStorage.setItem(`achachai-teacher-dismissed-${screen}`, '1'); } catch {}
  }

  function explainNow() {
    setShow(false);
    setDismissed(true);
    // Abrir el AgentDrawer con el prompt cargado
    if (agent && typeof agent.openAgent === 'function') {
      agent.openAgent({ prompt: contextPrompt });
    } else {
      // Fallback: si por algun motivo no hay AgentProvider, abrir el chat con un evento
      const ev = new CustomEvent('achachai:explain', { detail: { prompt: contextPrompt } });
      window.dispatchEvent(ev);
    }
    try { sessionStorage.setItem(`achachai-teacher-dismissed-${screen}`, '1'); } catch {}
  }

  if (dismissed && !show) return null;

  // Estilos segun posicion
  const posStyle: any = position === 'tr'
    ? { position: 'absolute', top: 18, right: 18 }
    : position === 'br'
    ? { position: 'fixed', bottom: 100, right: 24 }
    : { position: 'relative' };

  return (
    <div
      style={{
        ...posStyle,
        zIndex: 50,
        maxWidth: 320,
        background: 'linear-gradient(135deg, #fff 0%, #fef6ee 100%)',
        border: '1px solid #e76f51',
        borderRadius: 14,
        padding: 14,
        boxShadow: '0 10px 30px rgba(231,111,81,0.20), 0 0 0 1px rgba(231,111,81,0.08)',
        animation: show ? 'teacher-in 0.4s ease-out' : undefined,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header con el cóndor + close */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'linear-gradient(135deg, #e76f51, #c5333a)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: '0 0 0 4px rgba(231,111,81,0.18)',
        }}>
          <CondorLogo size={26} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9.5, color: '#e76f51', fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <FaGraduationCap size={10} /> El cóndor profesor
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1f1f1f', marginTop: 3, lineHeight: 1.3 }}>
            {title}
          </div>
          <div style={{ fontSize: 11.5, color: '#666', marginTop: 4, lineHeight: 1.45 }}>
            {hook}
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            background: 'transparent', border: 0, color: '#999',
            cursor: 'pointer', padding: 4, marginTop: -2, marginRight: -2,
          }}
        >
          <FaTimes size={11} />
        </button>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button
          onClick={explainNow}
          style={{
            flex: 1, padding: '8px 14px', borderRadius: 8,
            background: 'linear-gradient(135deg, #e76f51, #d54a30)',
            color: '#fff', border: 0, fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(231,111,81,0.4)',
          }}
        >
          Sí, explicame con IA →
        </button>
        <button
          onClick={dismiss}
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: 'transparent', border: '1px solid #d4cdb8',
            color: '#666', fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Más tarde
        </button>
      </div>

      {/* Cola tipo bocadillo apuntando arriba */}
      <div style={{
        position: 'absolute', top: -7, left: 24,
        width: 14, height: 14, background: '#fff',
        borderTop: '1px solid #e76f51', borderLeft: '1px solid #e76f51',
        transform: 'rotate(45deg)',
      }} />

      <style jsx>{`
        @keyframes teacher-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
