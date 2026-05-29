'use client';
// @ts-nocheck
/**
 * Tour guiado MINIMALISTA, sin librerias externas, sin CDN.
 *
 * - Overlay oscuro pantalla completa
 * - Highlight con "ventana" recortada (box-shadow trick) sobre el elemento
 * - Popover flotante con titulo + descripcion + botones prev/next/done
 * - Auto-arranca la PRIMERA vez (flag localStorage)
 * - Boton "?" en el Topbar reabre el tour
 *
 * Selectores: data-tour="<id>" en elementos clave de la UI.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FaQuestionCircle, FaTimes, FaArrowLeft, FaArrowRight, FaCheck } from 'react-icons/fa';

const TUTORIAL_FLAG = 'achachai-tutorial-completed-v1';

type TourStep = {
  selector?: string;             // CSS selector. Si falta, modal centrado
  title: string;
  description: string;           // HTML permitido (texto plano + b/i/br/etc)
  align?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
};

const STEPS: TourStep[] = [
  {
    title: '🦅 Bienvenido a AchachAI',
    description:
      'Soy el <b>cóndor digital</b> que sobrevuela tu cartera y detecta posibles fraudes en siniestros — sin acusar, solo señalando con evidencia.<br/><br/>' +
      '<span style="opacity:.75">Este tour de 1 minuto te muestra cómo usar el sistema. Podés volver a abrirlo desde el botón <b>?</b> arriba a la derecha.</span>',
  },
  {
    selector: '[data-tour="sidebar-role"]',
    title: '👥 1. Elegí tu rol',
    description:
      'Acá cambiás entre <b>Analista Antifraude, Siniestros, Jefatura, Riesgos, Auditoría, Tecnología o Gerencia</b>. Cada rol tiene una vista distinta.',
    align: 'right',
  },
  {
    selector: '[data-tour="sidebar-home"]',
    title: '🏠 2. Mi vista',
    description:
      'Tu home según el rol elegido. Acá ves el <b>resumen del día</b>, KPIs principales y los casos que el cóndor recomienda revisar.',
    align: 'right',
  },
  {
    selector: '[data-tour="sidebar-bandeja"]',
    title: '📋 3. Bandeja priorizada',
    description:
      'Siniestros ordenados por <b>urgencia</b>: ROJO (revisar ya), AMARILLO (investigar hoy), VERDE (flujo normal).',
    align: 'right',
  },
  {
    selector: '[data-tour="sidebar-chat"]',
    title: '💬 4. Hablar con el cóndor',
    description:
      'Conversá con la IA en <b>español natural</b>. Responde con evidencia citada.<br/>🎤 También funciona por <b>voz</b>.',
    align: 'right',
  },
  {
    selector: '[data-tour="sidebar-evaluar"]',
    title: '⚡ 5. Evaluar caso nuevo',
    description:
      'Cargá un siniestro hipotético + sus documentos. El cóndor devuelve un score en segundos, detectando hasta <b>falsificación visual</b> de PDFs.',
    align: 'right',
  },
  {
    selector: '[data-tour="sidebar-red"]',
    title: '🕸️ 6. Red de relaciones',
    description:
      'Grafo que cruza <b>asegurados ↔ proveedores</b> para detectar redes organizadas de fraude.',
    align: 'right',
  },
  {
    title: '✅ Listo. Que el cóndor vuele por tu cartera',
    description:
      'Recordá:<br/>' +
      '<ul style="margin-top:8px; padding-left:18px; line-height:1.7;">' +
      '<li><b>El cóndor nunca acusa</b> — solo alerta para revisión humana.</li>' +
      '<li>Cada decisión es <b>auditable</b>: regla, señal, evidencia.</li>' +
      '<li>Si te perdés, el botón <b>?</b> arriba abre este tour otra vez.</li>' +
      '</ul>',
  },
];

// ============= helpers =============
function getRect(selector?: string): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  // Scroll suave para asegurar visibilidad
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch {}
  return el.getBoundingClientRect();
}

function popoverPosition(rect: DOMRect | null, align: TourStep['align'] = 'auto') {
  const POP_W = 380;
  const POP_H_EST = 200;
  const PAD = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) {
    // modal centrado
    return { left: (vw - POP_W) / 2, top: (vh - POP_H_EST) / 2 };
  }

  // Auto: elegir el lado con más espacio
  let resolved = align;
  if (resolved === 'auto' || !resolved) {
    if (rect.right + POP_W + PAD < vw) resolved = 'right';
    else if (rect.left - POP_W - PAD > 0) resolved = 'left';
    else if (rect.bottom + POP_H_EST + PAD < vh) resolved = 'bottom';
    else resolved = 'top';
  }

  let left = 0, top = 0;
  switch (resolved) {
    case 'right':
      left = rect.right + PAD;
      top = Math.max(PAD, Math.min(rect.top + rect.height / 2 - POP_H_EST / 2, vh - POP_H_EST - PAD));
      break;
    case 'left':
      left = rect.left - POP_W - PAD;
      top = Math.max(PAD, Math.min(rect.top + rect.height / 2 - POP_H_EST / 2, vh - POP_H_EST - PAD));
      break;
    case 'bottom':
      top = rect.bottom + PAD;
      left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - POP_W / 2, vw - POP_W - PAD));
      break;
    case 'top':
      top = rect.top - POP_H_EST - PAD;
      left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - POP_W / 2, vw - POP_W - PAD));
      break;
  }
  // Saneo final dentro del viewport
  left = Math.max(PAD, Math.min(left, vw - POP_W - PAD));
  top = Math.max(PAD, Math.min(top, vh - 50));
  return { left, top };
}

// ============= UI =============
function TourOverlay({ onClose }: { onClose: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tick, setTick] = useState(0);
  const step = STEPS[stepIdx];

  // Filtrar pasos cuyo selector no existe en DOM
  const validSteps = STEPS.filter(s => !s.selector || document.querySelector(s.selector));
  // Re-mapear si el step actual fue filtrado
  const actualIdx = Math.min(stepIdx, validSteps.length - 1);
  const actualStep = validSteps[actualIdx];

  useLayoutEffect(() => {
    setRect(getRect(actualStep.selector));
    // Re-medir en resize
    const onResize = () => setTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [actualIdx, tick]);

  // Recalcular rect cuando scrollIntoView termina
  useEffect(() => {
    const t = setTimeout(() => setRect(getRect(actualStep.selector)), 350);
    return () => clearTimeout(t);
  }, [actualIdx]);

  function finish() {
    try { localStorage.setItem(TUTORIAL_FLAG, '1'); } catch {}
    onClose();
  }

  const isLast = actualIdx === validSteps.length - 1;
  const isFirst = actualIdx === 0;
  const pos = popoverPosition(rect, actualStep.align);

  const HIGHLIGHT_PAD = 6;
  const highlightRect = rect && {
    left: rect.left - HIGHLIGHT_PAD,
    top: rect.top - HIGHLIGHT_PAD,
    width: rect.width + HIGHLIGHT_PAD * 2,
    height: rect.height + HIGHLIGHT_PAD * 2,
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Overlay oscuro con "agujero" sobre el elemento destacado */}
      <div
        onClick={finish}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.72)',
          pointerEvents: 'auto',
          transition: 'background 0.2s',
        }}
      />
      {/* Spotlight: borde + sombra exterior que crea el efecto de iluminacion */}
      {highlightRect && (
        <div
          style={{
            position: 'fixed',
            left: highlightRect.left,
            top: highlightRect.top,
            width: highlightRect.width,
            height: highlightRect.height,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72), 0 0 0 3px #e76f51, 0 0 40px rgba(231,111,81,0.6)',
            background: 'transparent',
            transition: 'all 0.3s ease',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Popover */}
      <div
        role="dialog"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: pos.left,
          top: pos.top,
          width: 380,
          background: '#fff',
          color: '#1f1f1f',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)',
          pointerEvents: 'auto',
          fontFamily: 'Inter, system-ui, sans-serif',
          transition: 'left 0.3s ease, top 0.3s ease',
        }}
      >
        {/* Close button arriba a la derecha */}
        <button
          onClick={finish}
          aria-label="Cerrar tour"
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 28, height: 28, borderRadius: '50%',
            background: 'transparent', border: 0, cursor: 'pointer',
            color: '#888', display: 'grid', placeItems: 'center',
          }}
        >
          <FaTimes size={13} />
        </button>

        {/* Progreso */}
        <div style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#e76f51', fontWeight: 700, marginBottom: 6,
        }}>
          Paso {actualIdx + 1} de {validSteps.length}
        </div>

        {/* Titulo */}
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#1f1f1f',
          lineHeight: 1.25, marginBottom: 10, paddingRight: 24,
        }}>
          {actualStep.title}
        </div>

        {/* Descripcion */}
        <div
          style={{ fontSize: 13.5, lineHeight: 1.55, color: '#4a4a4a' }}
          dangerouslySetInnerHTML={{ __html: actualStep.description }}
        />

        {/* Barra de progreso */}
        <div style={{
          marginTop: 16, height: 4, borderRadius: 2,
          background: '#f0eae0', overflow: 'hidden',
        }}>
          <div style={{
            width: `${((actualIdx + 1) / validSteps.length) * 100}%`,
            height: '100%', background: 'linear-gradient(90deg, #e76f51, #d54a30)',
            transition: 'width 0.3s ease',
          }}/>
        </div>

        {/* Botones */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 14, justifyContent: 'space-between',
        }}>
          <button
            onClick={() => setStepIdx(i => Math.max(0, i - 1))}
            disabled={isFirst}
            style={{
              padding: '8px 12px', borderRadius: 6,
              background: 'transparent', border: '1px solid #d4cdb8',
              color: isFirst ? '#bbb' : '#666', fontSize: 12.5,
              cursor: isFirst ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <FaArrowLeft size={10} /> Atrás
          </button>

          {isLast ? (
            <button
              onClick={finish}
              style={{
                padding: '8px 16px', borderRadius: 6,
                background: 'linear-gradient(135deg, #e76f51, #d54a30)',
                color: '#fff', border: 0, fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(231,111,81,0.4)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <FaCheck size={11} /> Listo 🦅
            </button>
          ) : (
            <button
              onClick={() => setStepIdx(i => Math.min(validSteps.length - 1, i + 1))}
              style={{
                padding: '8px 16px', borderRadius: 6,
                background: 'linear-gradient(135deg, #e76f51, #d54a30)',
                color: '#fff', border: 0, fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(231,111,81,0.4)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              Siguiente <FaArrowRight size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= API publica =============
export function useAutoStartTutorial(enabled: boolean = true) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let completed = false;
    try { completed = localStorage.getItem(TUTORIAL_FLAG) === '1'; } catch {}
    if (completed) return;
    // Esperar un poco a que la UI termine de montar
    const t = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(t);
  }, [enabled]);

  // Exponer un trigger global para que TutorialButton lo dispare
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__achachaiOpenTour = () => setShow(true);
    return () => { delete (window as any).__achachaiOpenTour; };
  }, []);

  if (!show) return null;
  return <TourOverlay onClose={() => setShow(false)} />;
}

export function TutorialButton({ compact = false }: { compact?: boolean }) {
  const handleClick = useCallback(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(TUTORIAL_FLAG); } catch {}
    const trigger = (window as any).__achachaiOpenTour;
    if (typeof trigger === 'function') {
      trigger();
    } else {
      // Si el hook no esta montado, recargar la pagina hara que arranque
      window.location.reload();
    }
  }, []);

  if (compact) {
    return (
      <button
        type="button"
        className="icon-btn"
        aria-label="Tutorial guiado"
        title="Tutorial guiado — cómo usar AchachAI"
        onClick={handleClick}
      >
        <FaQuestionCircle size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 8,
        background: '#e76f51', color: '#fff',
        border: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600,
      }}
    >
      <FaQuestionCircle size={14} /> Ver tutorial
    </button>
  );
}
