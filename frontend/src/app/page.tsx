'use client';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.replace('/achachai/AchachAI.html');
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 18, fontFamily: 'serif' }}>Cargando AchachAI…</div>
      <div style={{ fontSize: 12, color: '#888' }}>
        Si no avanza, abre <a href="/achachai/AchachAI.html" style={{ color: '#0066ff' }}>/achachai/AchachAI.html</a>
      </div>
    </div>
  );
}
