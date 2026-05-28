'use client';
import { useState } from 'react';
import { CondorBubble, LearningBar } from './_components/Condor';
import { CondorLogo } from './_components/CondorLogo';
import { ChatScreen } from './_components/Chat';
import { InvestigationScreen } from './_components/Investigation';
import {
  KanbanScreen,
  DocumentsScreen,
  TejidoScreen,
  ReportsScreen,
  RolesScreen,
  ROLES,
} from './_components/Screens';
import { RoleHome } from './_components/RoleHomes';

const NAV = [
  { id: 'home',      label: 'Mi vista',          glyph: '✦', hint: 'rol' },
  { id: 'chat',      label: 'Cóndor agéntico',   glyph: '▲', hint: 'CU-05' },
  { id: 'kanban',    label: 'Bandeja',           glyph: '❒', hint: 'CU-03' },
  { id: 'documents', label: 'Documentos',        glyph: '✎', hint: 'CU-01' },
  { id: 'tejido',    label: 'Tejido del fraude', glyph: '◇', hint: 'Red' },
  { id: 'reports',   label: 'Reportes',          glyph: '▦', hint: 'CU-06' },
  { id: 'roles',     label: 'Cambiar de rol',    glyph: '⇄', hint: '7 vistas' },
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
        width: 232,
        background: 'linear-gradient(180deg, rgba(7, 20, 38, 0.92) 0%, rgba(3, 11, 28, 0.95) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        gap: 18,
        borderRight: '1px solid rgba(6, 182, 212, 0.18)',
        boxShadow: '0 0 60px rgba(6, 182, 212, 0.08)',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
        <div
          style={{
            width: 46,
            height: 46,
            display: 'grid',
            placeItems: 'center',
            filter: 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.55))',
          }}
        >
          <CondorLogo size={46} />
        </div>
        <div>
          <div className="display" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>
            Achach<span style={{
              background: 'linear-gradient(135deg, #1565C0, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>AI</span>
          </div>
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: '.18em',
              color: 'rgba(103, 232, 249, 0.65)',
              marginTop: 4,
              fontWeight: 600,
            }}
          >
            OJOS DE CÓNDOR
          </div>
        </div>
      </div>

      <div
        onClick={() => onNav('roles')}
        style={{
          padding: '12px 14px',
          borderRadius: 14,
          background: 'rgba(6, 182, 212, 0.06)',
          cursor: 'pointer',
          border: '1px solid rgba(6, 182, 212, 0.18)',
          borderLeft: `3px solid ${r.color}`,
          backdropFilter: 'blur(6px)',
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            color: 'rgba(203, 213, 225, 0.55)',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Sesión activa
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginTop: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-primary)',
          }}
        >
          <span>{r.icon}</span> María Yánez
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(203, 213, 225, 0.75)', marginTop: 2 }}>{r.name}</div>
        <div style={{ fontSize: 9.5, color: 'rgba(103, 232, 249, 0.7)', marginTop: 5, fontWeight: 500 }}>cambiar de rol →</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
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
                padding: '10px 12px',
                borderRadius: 10,
                background: isActive
                  ? 'linear-gradient(135deg, rgba(21, 101, 192, 0.20), rgba(6, 182, 212, 0.18))'
                  : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'rgba(203, 213, 225, 0.78)',
                border: isActive ? '1px solid rgba(6, 182, 212, 0.45)' : '1px solid transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                textAlign: 'left',
                width: '100%',
                boxShadow: isActive ? '0 0 18px rgba(6, 182, 212, 0.18), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                transition: 'background .15s ease, color .15s ease, border-color .15s ease',
              }}
            >
              <span style={{
                width: 16,
                fontSize: 13,
                color: isActive ? '#22D3EE' : 'rgba(148, 163, 184, 0.6)',
              }}>{n.glyph}</span>
              <span style={{ flex: 1 }}>{n.label}</span>
              <span style={{
                fontSize: 9,
                color: isActive ? 'rgba(103, 232, 249, 0.7)' : 'rgba(148, 163, 184, 0.45)',
                letterSpacing: '.12em',
                fontFamily: 'var(--mono)',
              }}>{n.hint}</span>
            </button>
          );
        })}
      </nav>

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 14,
          background: 'rgba(7, 20, 38, 0.6)',
          border: '1px solid rgba(34, 197, 94, 0.18)',
          fontSize: 10.5,
          color: 'rgba(203, 213, 225, 0.75)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--paramo-green)',
            boxShadow: '0 0 8px rgba(34, 197, 94, 0.7)',
          }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Azure ML · v4.2.1 · sano</span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'rgba(148, 163, 184, 0.7)' }}>25.460 siniestros · AUC 0.96</div>
      </div>
    </aside>
  );
}

export default function AchachaiApp() {
  const [screen, setScreen] = useState<string>('home');
  const [caseId, setCaseId] = useState<string>('SIN-100029');
  const [role, setRole] = useState<string>('antifraude');

  function pickRole(r: string) {
    setRole(r);
    setScreen('home');
  }

  function investigate(id?: string) {
    setCaseId(id || 'SIN-100029');
    setScreen('investigation');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '232px 1fr', height: '100vh' }}>
      <Sidebar active={screen} onNav={setScreen} role={role} />

      <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <LearningBar />

        <div style={{ flex: 1, minHeight: 0 }}>
          {screen === 'home' && (
            <RoleHome role={role} onInvestigate={investigate} onGoChat={() => setScreen('chat')} />
          )}
          {screen === 'chat' && <ChatScreen role={role} onInvestigate={investigate} />}
          {screen === 'investigation' && (
            <InvestigationScreen caseId={caseId} onBack={() => setScreen('kanban')} />
          )}
          {screen === 'kanban' && <KanbanScreen onInvestigate={investigate} />}
          {screen === 'documents' && <DocumentsScreen />}
          {screen === 'tejido' && <TejidoScreen />}
          {screen === 'reports' && <ReportsScreen />}
          {screen === 'roles' && <RolesScreen currentRole={role} onPick={pickRole} />}
        </div>
      </main>

      <CondorBubble
        onOpen={() => setScreen('chat')}
        mood={screen === 'investigation' || screen === 'kanban' ? 'alert' : 'idle'}
        message={
          screen === 'home' ? 'Hola María. Sobrevolé tu cartera. Hay 12 casos en rojo nuevos.' : null
        }
      />
    </div>
  );
}
