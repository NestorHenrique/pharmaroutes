import type { Metadata, Viewport } from 'next';
import './globals.css';

// Não bloqueamos o zoom do usuário (acessibilidade, WCAG 1.4.4).
// O zoom automático do iOS ao focar campos é evitado com inputs de 16px no mobile.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
};

export const metadata: Metadata = {
  title: 'Rota Propagandista',
  description: 'Sistema de Roteiro de Visitas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="bg-slate-950">
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
