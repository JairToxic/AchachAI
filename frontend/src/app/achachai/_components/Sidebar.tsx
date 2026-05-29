'use client';
import { useEffect, useRef, useState } from 'react';
import {
  FaHome,
  FaRobot,
  FaInbox,
  FaSearch,
  FaUpload,
  FaBolt,
  FaShieldAlt,
  FaMagic,
  FaFileAlt,
  FaNetworkWired,
  FaChartBar,
  FaCog,
  FaExchangeAlt,
  FaChevronDown,
  FaUserShield,
  FaUserTie,
  FaUserCog,
  FaUsers,
  FaBriefcase,
  FaUserNurse,
  FaBalanceScale,
} from 'react-icons/fa';
import { CondorLogo } from './CondorLogo';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  hint?: string;
}

export const SIDEBAR_NAV: NavItem[] = [
  { id: 'home',       label: 'Mi vista',             icon: FaHome,           hint: 'inicio' },
  { id: 'chat',       label: 'Hablar con el cóndor', icon: FaRobot,          hint: 'chat IA' },
  { id: 'kanban',     label: 'Bandeja priorizada',   icon: FaInbox,          hint: 'pendientes' },
  { id: 'explorar',   label: 'Explorar siniestros',  icon: FaSearch,         hint: 'buscar' },
  { id: 'cargar',     label: 'Cargar casos',         icon: FaUpload,         hint: 'CSV + form' },
  { id: 'evaluar',    label: 'Evaluar caso nuevo',   icon: FaBolt,           hint: 'simular' },
  { id: 'prevencion', label: 'Prevención',           icon: FaShieldAlt,      hint: 'temprano' },
  { id: 'anomalias',  label: 'Patrones inusuales',   icon: FaMagic,          hint: 'descubrir' },
  { id: 'documents',  label: 'Analizar documento',   icon: FaFileAlt,        hint: 'subir' },
  { id: 'tejido',     label: 'Red de relaciones',    icon: FaNetworkWired,   hint: 'conexiones' },
  { id: 'reports',    label: 'Reportes',             icon: FaChartBar,       hint: 'exportar' },
  { id: 'ajustes',    label: 'Ajustes',              icon: FaCog,            hint: 'pesos' },
  { id: 'roles',      label: 'Cambiar de rol',       icon: FaExchangeAlt,    hint: 'vistas' },
];

export interface RoleOption {
  id: string;
  name: string;
  color: string;
  icon: React.ComponentType<{ size?: number }>;
}

export const SIDEBAR_ROLES: RoleOption[] = [
  { id: 'siniestros',  name: 'Analista de siniestros',  color: '#2563eb', icon: FaUserTie },
  { id: 'antifraude',  name: 'Analista antifraude',     color: '#ef4444', icon: FaUserShield },
  { id: 'jefatura',    name: 'Jefatura de siniestros',  color: '#06b6d4', icon: FaBriefcase },
  { id: 'riesgos',     name: 'Riesgos',                 color: '#f59e0b', icon: FaBalanceScale },
  { id: 'auditoria',   name: 'Auditoría interna',       color: '#7c3aed', icon: FaUserNurse },
  { id: 'tecnologia',  name: 'Tecnología',              color: '#22c55e', icon: FaUserCog },
  { id: 'gerencia',    name: 'Gerencia',                color: '#1a3a52', icon: FaUsers },
];

interface SidebarProps {
  active: string;
  onNav: (id: string) => void;
  role: string;
  onRoleChange: (roleId: string) => void;
  userName?: string;
  collapsed: boolean;
  modelStatus?: { label?: string; meta?: string };
  onCloseMobile?: () => void;
}

export function Sidebar({
  active,
  onNav,
  role,
  onRoleChange,
  userName = 'María Yánez',
  collapsed,
  modelStatus = { label: 'Azure ML · v5.0 multi-ramo · sano', meta: '39.960 siniestros · AUC 0.97' },
  onCloseMobile,
}: SidebarProps) {
  const currentRole = SIDEBAR_ROLES.find(r => r.id === role) || SIDEBAR_ROLES[1];
  const [roleOpen, setRoleOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roleOpen) return;
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setRoleOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [roleOpen]);

  function handleNav(id: string) {
    onNav(id);
    if (onCloseMobile) onCloseMobile();
  }

  function handleRolePick(id: string) {
    onRoleChange(id);
    setRoleOpen(false);
  }

  const RoleIcon = currentRole.icon;

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div
        className="sidebar-brand"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '4px 6px 2px',
        }}
      >
        <CondorLogo size={40} />
        <div className="sidebar-brand-text" style={{ minWidth: 0 }}>
          <div
            className="serif"
            style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.1, color: 'var(--text-on-dark)' }}
          >
            Cóndor Vision
          </div>
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: '0.14em',
              color: 'var(--text-on-dark-muted)',
              marginTop: 3,
              textTransform: 'uppercase',
            }}
          >
            by AchachAI
          </div>
        </div>
      </div>

      {/* Active session + role switcher */}
      <div ref={wrapRef} style={{ position: 'relative' }} className="sidebar-only-expanded">
        <div
          className="role-switcher"
          onClick={() => setRoleOpen(o => !o)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') setRoleOpen(o => !o);
          }}
          style={{ borderLeft: `3px solid ${currentRole.color}` }}
        >
          <div
            style={{
              fontSize: 9.5,
              color: 'var(--text-on-dark-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Sesión activa
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginTop: 2,
              color: 'var(--text-on-dark)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RoleIcon size={13} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-on-dark-muted)',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentRole.name}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(244,237,228,0.5)',
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FaExchangeAlt size={9} /> Cambiar de rol
            <FaChevronDown
              size={9}
              style={{
                marginLeft: 'auto',
                transition: 'transform .15s',
                transform: roleOpen ? 'rotate(180deg)' : 'rotate(0)',
              }}
            />
          </div>
        </div>

        {roleOpen && (
          <div className="role-dropdown" role="listbox">
            {SIDEBAR_ROLES.map(r => {
              const Icon = r.icon;
              return (
                <button
                  key={r.id}
                  type="button"
                  data-active={r.id === role}
                  onClick={() => handleRolePick(r.id)}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: r.color,
                      flexShrink: 0,
                    }}
                  />
                  <Icon size={13} />
                  <span style={{ flex: 1 }}>{r.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {SIDEBAR_NAV.map(item => {
          const Icon = item.icon;
          const isActive =
            active === item.id ||
            (active === 'investigation' && item.id === 'kanban') ||
            (active === 'asegurado' && item.id === 'kanban');
          return (
            <button
              key={item.id}
              type="button"
              className="nav-btn"
              data-active={isActive}
              data-tooltip={item.label}
              onClick={() => handleNav(item.id)}
            >
              <span className="nav-icon">
                <Icon size={16} />
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </aside>
  );
}

export default Sidebar;
