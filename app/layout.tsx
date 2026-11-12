import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

// Sem zoom automático do iOS ao tocar em campos: maximumScale 1 + inputs de 16px (globals.css).
// O iOS continua permitindo o zoom de pinça do usuário.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Ocupa a tela toda (inclusive atrás do notch/Dynamic Island); o cabeçalho usa env(safe-area-inset-top)
  viewportFit: 'cover',
  themeColor: '#0B0B12',
  // Escuro por padrão (Ônix); o tema claro (Marfim) é escolhido no app
  colorScheme: 'dark light',
};

export const metadata: Metadata = {
  title: 'Rota Propagandista',
  description: 'Sistema de Roteiro de Visitas',
  // App da Tela de Início do iPhone: barra de status translúcida sobre o cabeçalho
  icons: { apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] },
  appleWebApp: { capable: true, title: 'Rota Propagandista', statusBarStyle: 'black-translucent' },
};

const APP_BG = '#0B0B12';

/** Tema salvo no aparelho, aplicado ANTES da primeira pintura (sem piscar o outro tema) */
const THEME_SCRIPT = `(function () {
  try {
    var t = localStorage.getItem('pharma_theme');
    if (t === 'auto') t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'marfim' : 'onix';
    else if (t !== 'marfim') t = 'onix';
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'marfim' ? '#F7F6FB' : '#0B0B12');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'onix');
  }
})();`;

/**
 * Recuperação da "tela branca" no iOS (app da Tela de Início).
 * Roda fora do React, então funciona mesmo se o React não voltar:
 *  - ao voltar do Google Maps/WhatsApp: força um repaint (WebKit às vezes congela a pintura);
 *    se a página estiver vazia, recarrega (ou mostra "Recarregar" se estiver sem internet);
 *  - na abertura: se o app não ficar pronto em 12 s, mostra uma tela escura com "Recarregar".
 * O React marca <html data-app-ready="1"> ao montar (app/page.tsx).
 */
const RECOVERY_SCRIPT = `(function () {
  var d = document, de = d.documentElement;
  function ready() { return de.getAttribute('data-app-ready') === '1'; }
  function blank() { var b = d.body; return !b || !(b.innerText || '').trim(); }
  function repaint() {
    var b = d.body; if (!b) return;
    b.style.transform = 'translateZ(0)';
    requestAnimationFrame(function () { b.style.transform = ''; });
  }
  function showFallback() {
    if (!d.body || d.getElementById('pwa-recover')) return;
    var el = d.createElement('div');
    el.id = 'pwa-recover';
    el.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:${APP_BG};color:#e2e8f0;font:14px -apple-system,system-ui,sans-serif');
    el.innerHTML = '<div>O app não carregou.</div><div style="color:#94a3b8;font-size:12px">Verifique a internet e toque para recarregar.</div><button type="button" style="padding:10px 18px;border:0;border-radius:8px;background:#A78BFA;color:#0B0B12;font-weight:600;font-size:14px">Recarregar</button>';
    el.querySelector('button').onclick = function () { location.reload(); };
    d.body.appendChild(el);
  }
  function check() {
    repaint();
    setTimeout(function () {
      if (!blank()) return;
      if (navigator.onLine === false) showFallback(); else location.reload();
    }, 1200);
  }
  d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible') check(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });
  window.addEventListener('online', function () { if (d.getElementById('pwa-recover')) location.reload(); });
  setTimeout(function () { if (!ready()) showFallback(); }, 12000);
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      data-theme="onix"
      className={`${inter.variable} bg-slate-950`}
      style={{ backgroundColor: 'var(--background)' }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: RECOVERY_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased" style={{ backgroundColor: 'var(--background)' }}>
        {children}
      </body>
    </html>
  );
}
