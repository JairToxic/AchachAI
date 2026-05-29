'use client';
import { useEffect, useState } from 'react';
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
} from './_components/Screens';
import { RoleHome } from './_components/RoleHomes';
import { AgentProvider, AgentDrawer, AgentFAB, useAgent } from './_components/AgentDrawer';
import { Sidebar, SIDEBAR_NAV, SIDEBAR_ROLES } from './_components/Sidebar';
import { Topbar } from './_components/Topbar';
import { useAutoStartTutorial } from './_components/Tutorial';
import { useTheme } from './_components/ThemeToggle';

/** Mapa pantalla -> label legible + hint para inyectar al agente. */
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

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 900px)');
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener?.('change', apply);
    return () => mql.removeEventListener?.('change', apply);
  }, []);
  return isMobile;
}

export default function AchachaiApp() {
  const [screen, setScreen] = useState<string>('home');
  const [caseId, setCaseId] = useState<string>('SIN-100029');
  const [aseId, setAseId] = useState<string>('');
  const [role, setRole] = useState<string>('antifraude');

  // Tutorial guiado: se lanza solo la primera vez (flag localStorage).
  // Devuelve el overlay (o null) que renderizamos al final del componente.
  const tutorialOverlay = useAutoStartTutorial(true);

  // Sidebar state
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  // Theme bootstrap (loaded ASAP via layout, but mount the hook so it's reactive)
  const [theme] = useTheme();

  // Activa el watermark solo en dark
  const showWatermark = theme === 'dark';

  function toggleSidebar() {
    if (isMobile) setMobileOpen(o => !o);
    else setCollapsed(c => !c);
  }

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

  function handleAgentNavigate(a: any) {
    if (a.type === 'investigate' && a.id) investigate(a.id);
    else if (a.type === 'verAsegurado' && a.id) verAsegurado(a.id);
    else if (a.type === 'goto' && a.screen) setScreen(a.screen);
  }

  // Datos del header dinámicos según pantalla
  const activeNav = SIDEBAR_NAV.find(n =>
    n.id === screen || (screen === 'investigation' && n.id === 'kanban') || (screen === 'asegurado' && n.id === 'kanban'),
  );
  const activeRole = SIDEBAR_ROLES.find(r => r.id === role) || SIDEBAR_ROLES[1];

  let topTitle = activeNav?.label || 'AchachAI';
  let topSubtitle = activeRole.name;
  if (screen === 'investigation') {
    topTitle = `Investigación · ${caseId}`;
    topSubtitle = 'Vista forense del siniestro';
  } else if (screen === 'asegurado') {
    topTitle = `Asegurado · ${aseId || '—'}`;
    topSubtitle = 'Perfil e historial';
  }

  return (
    <AgentProvider onNavigate={handleAgentNavigate}>
      <ContextSync screen={screen} caseId={caseId} aseId={aseId} role={role} />
      <div
        className="app-shell"
        data-collapsed={collapsed ? 'true' : 'false'}
        data-mobile-open={mobileOpen ? 'true' : 'false'}
      >
        <Sidebar
          active={screen}
          onNav={setScreen}
          role={role}
          onRoleChange={pickRole}
          collapsed={collapsed}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Backdrop solo en mobile cuando el drawer está abierto */}
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        <main className="app-main">
          <Topbar
            title={topTitle}
            subtitle={topSubtitle}
            onToggleSidebar={toggleSidebar}
            notifications={3}
          />

          {/* Watermark sutil solo en dark mode */}
          {showWatermark && (
            <>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 0,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CondorSilhouette
                  width={820}
                  color="var(--accent)"
                  style={{
                    opacity: 0.05,
                    animation: 'condor-float 9s ease-in-out infinite',
                    transformOrigin: 'center',
                  }}
                />
              </div>
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 'var(--topbar-h)',
                  left: 0,
                  right: 0,
                  height: 56,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                  zIndex: 0,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    animation: 'condor-glide 14s linear infinite',
                    filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.35))',
                  }}
                >
                  <CondorSilhouette width={42} color="var(--accent)" style={{ opacity: 0.45 }} />
                </div>
              </div>
            </>
          )}

          <div className="app-content" style={{ zIndex: 1 }}>
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

        {/* Tour guiado (auto-arranca primera vez; el boton ? lo reabre) */}
        {tutorialOverlay}
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
    let label = meta.label;
    if (screen === 'investigation' && caseId) label = `Investigación · ${caseId}`;
    if (screen === 'asegurado' && aseId) label = `Asegurado · ${aseId}`;
    setScreenContext({ screen, label, hint: meta.hint, payload });
    return () => setScreenContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, caseId, aseId, role]);
  return null;
}
