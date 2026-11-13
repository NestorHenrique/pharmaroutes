# Layouts

Root layout sets fonts and data-theme (onix|marfim). App shell = sticky header per tab inside app/page.tsx + floating BottomNav.

### `app/layout.tsx`

```tsx
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
  // App da Tela de Início do iPhone. 'black-translucent' deixava o topo escurecido (efeito de borda do iOS sobre o cabeçalho)
  icons: { apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] },
  appleWebApp: { capable: true, title: 'Rota Propagandista', statusBarStyle: 'default' },
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

```

### `components/BottomNav.tsx`

```tsx
'use client';

import type { ReactNode } from 'react';

export type MainTab = 'hoje' | 'mapa' | 'medicos' | 'eu';

interface BottomNavProps {
  tab: MainTab;
  onTab: (tab: MainTab) => void;
  onAdd: () => void;
  onNotices: () => void;
  unread: number;
  /** foto ou iniciais do rep */
  avatar: ReactNode;
}

const svg = (d: ReactNode, w = 1.9) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const item = 'mx-auto flex h-14 w-full max-w-[68px] flex-col items-center justify-center gap-0.5 rounded-[18px] border-0 text-[11px] font-semibold';
const tone = (on: boolean) => (on ? 'bg-blue-950 text-blue-400' : 'bg-transparent text-slate-400');

/** Barra flutuante embaixo: Hoje, Mapa, Novo médico, Avisos e Eu, tudo no alcance do polegar. */
export default function BottomNav({ tab, onTab, onAdd, onNotices, unread, avatar }: BottomNavProps) {
  return (
    <nav aria-label="Menu principal" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
      <div className="pointer-events-auto mx-auto grid h-[68px] max-w-md grid-cols-5 items-center rounded-[26px] border border-slate-800 bg-slate-900/90 px-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <button type="button" onClick={() => onTab('hoje')} aria-current={tab === 'hoje' ? 'page' : undefined} className={`${item} ${tone(tab === 'hoje')}`}>
          {svg(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />)}
          Hoje
        </button>
        <button type="button" onClick={() => onTab('mapa')} aria-current={tab === 'mapa' ? 'page' : undefined} className={`${item} ${tone(tab === 'mapa')}`}>
          {svg(
            <>
              <path d="M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z" />
              <path d="M9 4v14M15 6v14" />
            </>,
          )}
          Mapa
        </button>
        <button
          type="button"
          onClick={onAdd}
          data-tour="add"
          aria-label="Novo médico"
          className="mx-auto flex size-[54px] items-center justify-center rounded-[20px] border-0 bg-blue-600 text-white shadow-lg shadow-black/30"
        >
          {svg(<path d="M12 5v14M5 12h14" />, 2.4)}
        </button>
        <button
          type="button"
          onClick={onNotices}
          data-tour="bell"
          aria-label={unread > 0 ? `Avisos dos colegas, ${unread} não lidos` : 'Avisos dos colegas'}
          className={`${item} relative bg-transparent text-slate-400`}
        >
          {svg(
            <>
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </>,
          )}
          Avisos
          {unread > 0 && (
            <span className="absolute left-1/2 top-1 ml-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white" aria-hidden="true">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <button type="button" onClick={() => onTab('eu')} data-tour="profile" aria-current={tab === 'eu' ? 'page' : undefined} className={`${item} ${tone(tab === 'eu')}`}>
          <span className="flex size-[26px] items-center justify-center overflow-hidden rounded-full border border-blue-800 bg-blue-950 text-[11px] font-bold text-blue-600">{avatar}</span>
          Eu
        </button>
      </div>
    </nav>
  );
}

```

### app/page.tsx header (lines 2187-2330, per-tab header blocks)

```tsx
      <header className={`sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md px-4 flex flex-col gap-3 ${mainTab === 'eu' ? 'pb-0' : 'border-b border-slate-800/80 pb-3'}`} style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        {mainTab === 'hoje' && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <button
                  type="button"
                  data-tour="week"
                  aria-label="Trocar semana de trabalho"
                  onClick={() => {
                    setWeekAuto(false);
                    setWeekPrompt(true);
                  }}
                  className="inline-flex min-h-6 items-center gap-1 self-start truncate border-0 bg-transparent p-0 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  {todayLabel(now)} ·{' '}
                  <span className="font-semibold text-blue-400">{activeWeek ? `${activeWeek}ª semana` : 'Escolher semana'}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <h1 className="m-0 flex items-center gap-2 text-[26px] font-extrabold leading-tight tracking-tight text-white">
                  <span className="truncate">{hojeTitle}</span>
                  <span
                    title={realtimeOn ? 'Tempo real conectado' : 'Tempo real desconectado (atualiza a cada 8 s)'}
                    className={`size-2 shrink-0 rounded-full ${realtimeOn ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  />
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                data-tour="help"
                aria-label="Guia de status e cores"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-base font-bold text-slate-300 hover:text-white"
              >
                ?
              </button>
              <ProgressRing value={visitedList.length} total={sortedDoctors.length} size={56} />
            </div>

            <nav data-tour="days" aria-label="Dias da semana" className="grid grid-cols-5 gap-1.5">
              {TABS_NAVEGACAO.filter((tab) => tab.value !== 'novos').map((tab) => {
                const on = selectedTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setSelectedTab(on ? null : tab.value)}
                    aria-pressed={on}
                    aria-label={tab.value === todayCode ? `${tab.label}, hoje` : undefined}
                    className={`relative h-11 rounded-[14px] text-[13px] ${
                      on ? 'border border-blue-600 bg-blue-600 font-bold text-white' : 'border border-slate-800 bg-slate-900 font-semibold text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                    {tab.value === todayCode && <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" aria-hidden="true" />}
                  </button>
                );
              })}
            </nav>

            <div className="flex gap-2">
              <button
                type="button"
                data-tour="search"
                onClick={() => goTab('medicos')}
                className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-3.5 text-left text-[15px] text-slate-500"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-400" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="truncate">Médico, especialidade, CRM…</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  filtersSnap.current = { cities: selectedCities, week: selectedWeek, cat: selectedCategory, turno: turnoFilter, specs: selectedSpecs, sort: sortMode };
                  setShowFilters((v) => !v);
                }}
                data-tour="filters"
                aria-label={activeFilterCount > 0 ? `Filtros, ${activeFilterCount} ativos` : 'Filtros'}
                aria-expanded={showFilters}
                className={`relative flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-slate-900 text-slate-100 ${
                  showFilters || activeFilterCount > 0 ? 'border-blue-600' : 'border-slate-800'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-[18px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </>
        )}

        {mainTab === 'mapa' && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-400">
              {todayLabel(now)} · {mapStops.length} de {mapTotal} com GPS
            </span>
            <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-tight text-white">Mapa da rota</h1>
          </div>
        )}

        {mainTab === 'medicos' && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => goTab('hoje')}
                aria-label="Voltar para Hoje"
                className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-slate-800 bg-slate-900 text-slate-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-xs font-medium text-slate-400">Sua base · {panelDoctors.length} médicos</span>
                <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-tight text-white">Médicos</h1>
              </div>
            </div>
            <label className="flex h-12 min-w-0 items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-3.5 focus-within:border-blue-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-400" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                autoFocus
                aria-label="Buscar médico"
                placeholder="Nome, especialidade, CRM, bairro…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setMedLimit(60);
                }}
                className="min-w-0 flex-1 border-0 bg-transparent text-base text-slate-100 outline-hidden placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden"
```
