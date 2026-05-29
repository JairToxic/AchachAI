'use client';
// @ts-nocheck
/**
 * Campana de notificaciones REAL — alimentada por:
 *   GET /prevencion/alertas-tempranas?ventana_dias=30
 *   GET /top-riesgo?limit=5&nivel=ROJO
 *
 * Muestra:
 *  - badge con cantidad de alertas reales
 *  - dropdown con alertas recientes (casos críticos + proveedores observados)
 *  - última actualización + botón refresh
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaBell, FaExclamationTriangle, FaSearch, FaSync, FaShieldAlt, FaUserShield,
} from 'react-icons/fa';

type Alert = {
  kind: 'rojo' | 'amarillo' | 'proveedor' | 'patron';
  id: string;
  title: string;
  detail: string;
  time?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function relativeTime(now: Date, refMins: number): string {
  if (refMins < 1) return 'ahora';
  if (refMins < 60) return `hace ${Math.round(refMins)} min`;
  if (refMins < 60 * 24) return `hace ${Math.round(refMins / 60)} h`;
  return `hace ${Math.round(refMins / (60 * 24))} d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const [rojoR, alertR] = await Promise.allSettled([
        fetch(`${API_URL}/top-riesgo?limit=5&nivel=ROJO`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/prevencion/alertas-tempranas?ventana_dias=30`).then(r => r.ok ? r.json() : null),
      ]);

      const result: Alert[] = [];
      const now = new Date();

      // Casos rojos top
      if (rojoR.status === 'fulfilled' && rojoR.value?.top) {
        for (const c of rojoR.value.top.slice(0, 3)) {
          result.push({
            kind: 'rojo',
            id: c.id_siniestro,
            title: `${c.id_siniestro} · ${c.ramo || 'Caso'} ROJO`,
            detail: `${c.cobertura} · $${(c.monto_reclamado_usd || 0).toLocaleString('en-US')} · ${c.ciudad || ''} · ${(c.reglas_disparadas || []).join(', ') || 'múltiples señales'}`,
            time: 'hoy',
          });
        }
      }

      // Alertas tempranas (proveedores recurrentes, patrones)
      if (alertR.status === 'fulfilled' && alertR.value) {
        const data = alertR.value;
        // Estructura esperada: { alertas: [{tipo, ...}] } o lista de objetos.
        const list = Array.isArray(data) ? data : (data.alertas || data.items || []);
        for (const a of list.slice(0, 4)) {
          const tipo = a.tipo || a.type || '';
          if (tipo.includes('proveedor') || a.id_proveedor) {
            result.push({
              kind: 'proveedor',
              id: a.id_proveedor || a.id || '?',
              title: a.titulo || `${a.id_proveedor} · proveedor observado`,
              detail: a.detalle || `${a.n_casos || a.casos || '?'} casos esta semana · ${a.ciudad || ''}`,
              time: 'esta semana',
            });
          } else {
            result.push({
              kind: 'patron',
              id: a.id || tipo || 'patron',
              title: a.titulo || tipo || 'Patrón detectado',
              detail: a.detalle || a.descripcion || a.mensaje || '',
              time: a.ventana || '30d',
            });
          }
        }
      }

      setAlerts(result);
      setLastFetch(now);
    } catch (e) {
      console.warn('NotificationBell fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    // Refresh suave cada 3 min
    const id = setInterval(fetchAlerts, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const n = alerts.length;
  const lastFetchMinsAgo = lastFetch ? (Date.now() - lastFetch.getTime()) / 60000 : 999;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Notificaciones"
        title={`Notificaciones (${n})`}
        style={{ position: 'relative' }}
        onClick={() => setOpen(o => !o)}
      >
        <FaBell size={16} />
        {n > 0 && (
          <span
            style={{
              position: 'absolute', top: 6, right: 6,
              minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 8, background: '#c5333a',
              color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {n > 9 ? '9+' : n}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 380, maxHeight: 480, overflow: 'auto',
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-color, #e6dfd1)',
            borderRadius: 12,
            boxShadow: '0 18px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
            zIndex: 200,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 14px', borderBottom: '1px solid var(--line, #e6dfd1)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #1f1f1f)' }}>
                Alertas del cóndor
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary, #888)', marginTop: 1 }}>
                {n === 0 ? 'Sin alertas críticas activas' : `${n} alerta(s) en vivo`}
                {lastFetch && <> · {relativeTime(new Date(), lastFetchMinsAgo)}</>}
              </div>
            </div>
            <button
              type="button"
              onClick={fetchAlerts}
              disabled={loading}
              title="Actualizar"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'transparent', border: '1px solid var(--line, #e6dfd1)',
                color: 'var(--text-secondary, #888)',
                cursor: loading ? 'wait' : 'pointer',
                display: 'grid', placeItems: 'center',
              }}
            >
              <FaSync size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {/* Body */}
          {loading && alerts.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
              Cargando alertas del backend…
            </div>
          )}

          {!loading && alerts.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
              <FaShieldAlt size={20} style={{ opacity: 0.4, marginBottom: 6 }} /><br/>
              No hay alertas críticas activas.
            </div>
          )}

          {alerts.map((a, i) => (
            <AlertRow key={`${a.kind}-${a.id}-${i}`} alert={a} />
          ))}

          {/* Footer */}
          <div style={{
            padding: '8px 14px', borderTop: '1px solid var(--line, #e6dfd1)',
            background: 'var(--marfil-paper, #faf8f3)',
            fontSize: 10.5, color: 'var(--text-secondary)', textAlign: 'center',
          }}>
            Refresca cada 3 min · alertas en vivo desde el backend
          </div>

          <style jsx>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const tone =
    alert.kind === 'rojo'      ? { color: '#c5333a', bg: 'rgba(197,51,58,0.06)',  Icon: FaExclamationTriangle } :
    alert.kind === 'proveedor' ? { color: '#d97706', bg: 'rgba(217,119,6,0.06)',  Icon: FaUserShield } :
    alert.kind === 'patron'    ? { color: '#1c5d99', bg: 'rgba(28,93,153,0.06)',  Icon: FaSearch } :
                                 { color: '#888',    bg: 'transparent',           Icon: FaBell };
  const Ic = tone.Icon;
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 14px',
      borderBottom: '1px solid var(--line, #f0eae0)',
      background: tone.bg,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: tone.color + '20', color: tone.color,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <Ic size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {alert.title}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)',
          marginTop: 2, lineHeight: 1.4,
        }}>
          {alert.detail}
        </div>
        {alert.time && (
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, opacity: 0.7 }}>
            {alert.time}
          </div>
        )}
      </div>
    </div>
  );
}
