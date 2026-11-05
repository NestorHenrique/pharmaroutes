import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Impede o zoom forçado em inputs no mobile
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
    <html lang="pt">
      <body className="bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}