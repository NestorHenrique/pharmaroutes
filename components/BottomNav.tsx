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

/** Barra fixa encostada embaixo (de ponta a ponta, acima da área do gesto do iPhone/Android): Hoje, Mapa, Novo médico, Avisos e Eu. */
export default function BottomNav({ tab, onTab, onAdd, onNotices, unread, avatar }: BottomNavProps) {
  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-900"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
    >
      <div className="mx-auto grid h-[64px] max-w-md grid-cols-5 items-center px-1.5">
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
