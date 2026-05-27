import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AchachAI · Ojos de cóndor sobre tu cartera',
  description: 'Detector de posibles fraudes en siniestros · hackIAthon 2026 · Aseguradora del Sur',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
