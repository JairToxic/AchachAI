'use client';
import { useEffect, useState } from 'react';
import { Condor, LearningBar } from './_components/Condor';
import { CondorSilhouette } from './_components/CondorSilhouette';
import { ChatScreen } from './_components/Chat';
import { InvestigationScreen } from './_components/Investigation';
import {
  KanbanScreen,
  DocumentsScreen,
  TejidoScreen,
  ReportsScreen,
  RolesScreen,
  EvaluarScreen,
  AseguradoScreen,
  AjustesScreen,
  AnomaliasScreen,
  PrevencionScreen,
  ExplorarScreen,
  CargarCasosScreen,
  ROLES,
} from './_components/Screens';
import { RoleHome } from './_components/RoleHomes';
import { AgentProvider, AgentDrawer, AgentFAB, useAgent } from './_components/AgentDrawer';

const NAV = [
  { id: 'home',      label: 'Mi vista',                glyph: '✦', hint: 'inicio' },
  { id: 'chat',      label: 'Hablar con el cóndor',    glyph: '▲', hint: 'chat IA' },
  { id: 'kanban',    label: 'Bandeja priorizada',      glyph: '❒', hint: 'pendientes' },
  { id: 'explorar',  label: 'Explorar siniestros',     glyph: '🔎', hint: 'buscar' },
  { id: 'cargar',    label: 'Cargar casos nuevos',     glyph: '📥', hint: 'CSV+form' },
  { id: 'evaluar',   label: 'Evaluar caso nuevo',      glyph: '⚡', hint: 'simular' },
  { id: 'prevencion',label: 'Prevención',              glyph: '🛡', hint: 'temprano' },
  { id: 'anomalias', label: 'Patrones inusuales',      glyph: '✨', hint: 'descubrir' },
  { id: 'documents', label: 'Analizar documento',      glyph: '✎', hint: 'subir' },
  { id: 'tejido',    label: 'Red de relaciones',       glyph: '◇', hint: 'conexiones' },
  { id: 'reports',   label: 'Reportes',                glyph: '▦', hint: 'exportar' },
  { id: 'ajustes',   label: 'Ajustes',                 glyph: '⚙', hint: 'pesos' },
  { id: 'roles',     label: 'Cambiar de rol',          glyph: '⇄', hint: '7 vistas' },
];

interface SidebarProps {
  active: string;
  onNav: (s: string) => void;
  role: string;
}

function Sidebar({ active, onNav, role }: SidebarProps) {
  const r = (ROLES as any[]).find(x => x.id === role) || (ROLES as any[])[0];
  return (
    <aside
      style={{
        width: 220,
        background: 'var(--condor-wing)',
        color: 'var(--marfil)',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: 'var(--marfil)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Condor size={30} tone="wing" mood="idle" />
        </div>
        <div>
          <div className="serif" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1 }}>
            Achach<span style={{ color: 'var(--andes-orange)' }}>AI</span>
          </div>
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: '.14em',
              color: 'rgba(244,237,228,0.55)',
              marginTop: 3,
            }}
          >
            OJOS DE CÓNDOR
          </div>
        </div>
      </div>

      <div
        onClick={() => onNav('roles')}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(244,237,228,0.06)',
          cursor: 'pointer',
          borderLeft: `3px solid ${r.color}`,
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            color: 'rgba(244,237,228,0.55)',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
          }}
        >
          Sesión activa
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>{r.icon}</span> María Yánez
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(244,237,228,0.6)', marginTop: 1 }}>{r.name}</div>
        <div style={{ fontSize: 9.5, color: 'rgba(244,237,228,0.4)', marginTop: 4 }}>cambiar de rol →</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV.map(n => {
          const isActive = active === n.id || (active === 'investigation' && n.id === 'kanban');
          return (
            <button
              key={n.id}
              onClick={() => onNav(n.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                background: isActive ? 'rgba(244,237,228,0.10)' : 'transparent',
                color: isActive ? 'var(--marfil)' : 'rgba(244,237,228,0.78)',
                border: 0,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                textAlign: 'left',
                width: '100%',
                borderLeft: isActive ? '2px solid var(--andes-orange)' : '2px solid transparent',
              }}
            >
              <span style={{ width: 16, fontSize: 13, color: isActive ? 'var(--andes-orange)' : 'rgba(244,237,228,0.45)' }}>{n.glyph}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              <span style={{ fontSize: 9, color: 'rgba(244,237,228,0.35)', letterSpacing: '.1em' }}>{n.hint}</span>
            </button>
          );
        })}
      </nav>

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(244,237,228,0.04)',
          fontSize: 10.5,
          color: 'rgba(244,237,228,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--paramo-green)' }} />
          Azure ML · v4.2.1 · sano
        </div>
        <div>25.460 siniestros · AUC 0.96</div>
      </div>
    </aside>
  );
}

/** Mapa pantalla → label legible + hint para inyectar al agente. */
const SCREEN_META: Record<string, { label: string; hint?: string }> = {
  home:          { label: 'Mi vista (home del rol)',         hint: 'El usuario está en su dashboard inicial' },
  chat:          { label: 'Conversación con el cóndor',      hint: 'Usuario en el chat full-screen' },
  kanban:        { label: 'Bandeja priorizada',              hint: 'Lista de pendientes a resolver' },
  explorar:      { label: 'Explorar siniestros',             hint: 'Búsqueda libre en la cartera' },
  cargar:        { label: 'Cargar casos nuevos',             hint: 'Subida de CSV o ingreso manual' },
  evaluar:       { label: 'Evaluar caso nuevo',              hint: 'Formulario de evaluación rápida' },
  prevencion:    { label: 'Prevención (alertas tempranas)',  hint: 'Vista preventiva: patrones, alertas tempranas' },
  anomalias:     { label: 'Patrones inusuales',              hint: 'Anomalías no supervisadas (IsolationForest + AutoEncoder)' },
  documents:     { label: 'Analizar documento',              hint: 'Análisis multimodal de factura/foto/parte policial' },
  tejido:        { label: 'Red de relaciones',               hint: 'Grafo asegurado-proveedor-vehículo' },
  reports:       { label: 'Reportes',                        hint: 'Generación de reportes PDF para distintas audiencias' },
  ajustes:       { label: 'Ajustes (modelo + fairness)',     hint: 'Configuración y auditoría del modelo' },
  roles:         { label: 'Cambiar de rol',                  hint: 'Selector de rol del usuario' },
  investigation: { label: 'Investigación de caso',           hint: 'Vista forense de un siniestro' },
  asegurado:     { label: 'Ficha del asegurado',             hint: 'Perfil + historial de un asegurado' },
};

export default function AchachaiApp() {
  const [screen, setScreen] = useState<string>('home');
  const [caseId, setCaseId] = useState<string>('SIN-100029');
  const [aseId, setAseId] = useState<string>('');
  const [role, setRole] = useState<string>('antifraude');

  function pickRole(r: string) {
    setRole(r);
    setScreen('home');
  }

  function investigate(id?: string) {
    setCaseId(id || 'SIN-100029');
    setScreen('investigation');
  }

  function verAsegurado(id: string) {
    setAseId(id);
    setScreen('asegurado');
  }

  /** Handler que el AgentProvider invoca cuando el chat pide navegar. */
  function handleAgentNavigate(a: any) {
    if (a.type === 'investigate' && a.id) investigate(a.id);
    else if (a.type === 'verAsegurado' && a.id) verAsegurado(a.id);
    else if (a.type === 'goto' && a.screen) setScreen(a.screen);
  }

  return (
    <AgentProvider onNavigate={handleAgentNavigate}>
      <ContextSync screen={screen} caseId={caseId} aseId={aseId} role={role} />
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', height: '100vh' }}>
        <Sidebar active={screen} onNav={setScreen} role={role} />

        <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          {/* watermark global: cóndor planeando detrás de TODAS las pantallas */}
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0, zIndex: 0,
              pointerEvents: 'none', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CondorSilhouette
              width={820}
              color="var(--condor-wing)"
              style={{
                opacity: 0.07,
                animation: 'condor-float 9s ease-in-out infinite',
                transformOrigin: 'center',
              }}
            />
          </div>

          {/* cóndor extra planeando permanente en la esquina superior derecha */}
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 56,
              pointerEvents: 'none', overflow: 'hidden', zIndex: 0,
            }}
          >
            <div
              style={{
                position: 'absolute', top: 14,
                animation: 'condor-glide 14s linear infinite',
                filter: 'drop-shadow(0 0 8px rgba(232,122,79,0.35))',
              }}
            >
              <CondorSilhouette width={42} color="var(--andes-orange)" style={{ opacity: 0.45 }} />
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <LearningBar />
          </div>

          <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>
            {screen === 'home' && (
              <RoleHome role={role} onInvestigate={investigate} onGoChat={() => setScreen('chat')} />
            )}
            {screen === 'chat' && <ChatScreen role={role} onInvestigate={investigate} />}
            {screen === 'investigation' && (
              <InvestigationScreen
                caseId={caseId}
                onBack={() => setScreen('kanban')}
                onVerAsegurado={verAsegurado}
              />
            )}
            {screen === 'asegurado' && (
              <AseguradoScreen
                aseguradoId={aseId}
                onBack={() => setScreen(caseId ? 'investigation' : 'kanban')}
                onInvestigate={investigate}
              />
            )}
            {screen === 'kanban' && <KanbanScreen onInvestigate={investigate} />}
            {screen === 'explorar' && <ExplorarScreen onInvestigate={investigate} />}
            {screen === 'cargar' && <CargarCasosScreen onInvestigate={investigate} />}
            {screen === 'evaluar' && <EvaluarScreen />}
            {screen === 'prevencion' && <PrevencionScreen onInvestigate={investigate} />}
            {screen === 'anomalias' && <AnomaliasScreen onInvestigate={investigate} />}
            {screen === 'ajustes' && <AjustesScreen />}
            {screen === 'documents' && <DocumentsScreen onInvestigate={investigate} />}
            {screen === 'tejido' && <TejidoScreen onInvestigate={investigate} onVerAsegurado={verAsegurado} />}
            {screen === 'reports' && <ReportsScreen />}
            {screen === 'roles' && <RolesScreen currentRole={role} onPick={pickRole} />}
          </div>
        </main>

        {/* Drawer global del agente + FAB en TODAS las pantallas */}
        <AgentDrawer role={role} />
        <AgentFAB
          mood={screen === 'investigation' || screen === 'kanban' ? 'alert' : 'idle'}
          message={screen === 'home' ? 'Hola María. Sobrevolé tu cartera. Hay 12 casos en rojo nuevos.' : null}
        />
      </div>
    </AgentProvider>
  );
}

/**
 * Pequeño componente sin UI: sincroniza el contexto de la pantalla actual con el
 * AgentProvider para que el drawer sepa siempre dónde está el usuario y pueda
 * inyectar pistas al agente sin que el usuario tenga que repetir el caso.
 */
function ContextSync({
  screen, caseId, aseId, role,
}: { screen: string; caseId: string; aseId: string; role: string }) {
  const { setScreenContext } = useAgent();
  useEffect(() => {
    const meta = SCREEN_META[screen] || { label: screen };
    const payload: any = { role };
    if (screen === 'investigation') payload.caseId = caseId;
    if (screen === 'asegurado') payload.aseguradoId = aseId;
    // Para investigation/asegurado, incluimos el id en el label para que se lea bien arriba.
    let label = meta.label;
    if (screen === 'investigation' && caseId) label = `Investigación · ${caseId}`;
    if (screen === 'asegurado' && aseId) label = `Asegurado · ${aseId}`;
    setScreenContext({ screen, label, hint: meta.hint, payload });
    return () => setScreenContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, caseId, aseId, role]);
  return null;
}
