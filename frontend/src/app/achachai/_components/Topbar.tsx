'use client';
import { FaBars, FaSearch, FaUserCircle, FaCog } from 'react-icons/fa';
import { ThemeToggle } from './ThemeToggle';
import { TutorialButton } from './Tutorial';
import { NotificationBell } from './NotificationBell';

interface TopbarProps {
  title?: string;
  subtitle?: string;
  onToggleSidebar: () => void;
  onSearch?: (q: string) => void;
  notifications?: number;
}

export function Topbar({
  title,
  subtitle,
  onToggleSidebar,
  onSearch,
  notifications = 0,
}: TopbarProps) {
  return (
    <header className="app-topbar">
      <button
        type="button"
        className="icon-btn"
        onClick={onToggleSidebar}
        aria-label="Alternar menú lateral"
        title="Menú"
      >
        <FaBars size={16} />
      </button>

      {(title || subtitle) && (
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {title && (
            <div
              className="display"
              style={{
                fontSize: 16,
                color: 'var(--text-primary)',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-secondary)',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TutorialButton compact />
        <ThemeToggle />

        <NotificationBell />
        {/* notifications prop ya no se usa, NotificationBell hace fetch real */}
        {false && notifications}

        <button type="button" className="icon-btn" aria-label="Ajustes" title="Ajustes">
          <FaCog size={16} />
        </button>

        <button type="button" className="icon-btn" aria-label="Cuenta" title="Cuenta">
          <FaUserCircle size={18} />
        </button>
      </div>
    </header>
  );
}

export default Topbar;
