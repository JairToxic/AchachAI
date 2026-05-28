'use client';
import { useCallback, useEffect, useState } from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';

const STORAGE_KEY = 'achachai-theme';
type Theme = 'light' | 'dark';

/** Hook reutilizable para leer/cambiar el tema. Persiste en localStorage. */
export function useTheme(): [Theme, (t: Theme) => void, () => void, boolean] {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
      setThemeState(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } catch {
      /* noop */
    }
    setMounted(true);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
      document.documentElement.setAttribute('data-theme', t);
    } catch {
      /* noop */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  return [theme, setTheme, toggleTheme, mounted];
}

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
}

export function ThemeToggle({ className = '', style = {} }: ThemeToggleProps) {
  const [theme, , toggleTheme, mounted] = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`icon-btn ${className}`}
      style={style}
      aria-label={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}
      title={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}
      suppressHydrationWarning
    >
      {/* Para evitar mismatch SSR/CSR, no renderizamos el icono hasta despues del mount */}
      <span suppressHydrationWarning style={{ display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
        {mounted ? (isDark ? <FaSun size={16} /> : <FaMoon size={16} />) : null}
      </span>
    </button>
  );
}

export default ThemeToggle;
