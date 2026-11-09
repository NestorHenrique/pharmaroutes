import type { Metadata, Viewport } from 'next';
import './globals.css';

// Não bloqueamos o zoom do usuário (acessibilidade, WCAG 1.4.4).
// O zoom automático do iOS ao focar campos é evitado com inputs de 16px no mobile.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
  // Fundo padrão escuro no WebKit: sem "flash" branco enquanto o CSS ainda não chegou
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  title: 'Rota Propagandista',
  description: 'Sistema de Roteiro de Visitas',
};

const APP_BG = '#020617';

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
    el.innerHTML = '<div>O app não carregou.</div><div style="color:#94a3b8;font-size:12px">Verifique a internet e toque para recarregar.</div><button type="button" style="padding:10px 18px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;font-size:14px">Recarregar</button>';
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
    <html lang="pt-BR" className="bg-slate-950" style={{ backgroundColor: APP_BG }}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RECOVERY_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased" style={{ backgroundColor: APP_BG }}>
        {children}
      </body>
    </html>
  );
}
