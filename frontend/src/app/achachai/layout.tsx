import './design-system.css';

export const metadata = {
  title: 'AchachAI · Ojos de cóndor sobre tu cartera',
  description: 'Detector de posibles fraudes en siniestros - hackIAthon 2026',
};

const themeBootstrap = `(function(){try{var t=localStorage.getItem('achachai-theme');if(!t){t='light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function AchachaiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      <div style={{ height: '100vh', overflow: 'hidden' }}>{children}</div>
    </>
  );
}
