import './design-system.css';

export const metadata = {
  title: 'AchachAI · Ojos de cóndor sobre tu cartera',
  description: 'Detector de posibles fraudes en siniestros - hackIAthon 2026',
};

export default function AchachaiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div style={{ height: '100vh', overflow: 'hidden' }}>{children}</div>
    </>
  );
}
