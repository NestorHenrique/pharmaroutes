'use client';

import type { ReactNode } from 'react';
import ProgressRing from '@/components/ProgressRing';

interface MeTabProps {
  name: string;
  avatar: ReactNode;
  todayDone: number;
  todayTotal: number;
  /** médicos do painel já visitados neste ciclo e total do painel */
  cycleDone: number;
  cycleTotal: number;
  weekLabel: string | null;
  weekVisits: number;
  perDayAvg: string;
  cities: number;
  /** visitas de segunda a sexta desta semana */
  perDay: number[];
  todayIndex: number;
  onWeek: () => void;
  onCiclo?: () => void;
  onStatus: () => void;
  onGuide: () => void;
  onProfile: () => void;
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

/** Aba "Eu": como está o dia, a semana e o ciclo do rep, e os atalhos de ajuste. */
export default function MeTab(p: MeTabProps) {
  const pct = p.cycleTotal > 0 ? Math.round((p.cycleDone / p.cycleTotal) * 100) : 0;
  const top = Math.max(1, ...p.perDay);
  const rows: { label: string; hint: string; onClick: () => void }[] = [
    { label: 'Semana e cidades', hint: p.weekLabel ?? 'Escolher semana', onClick: p.onWeek },
    { label: 'Status geral', hint: 'Médicos marcados pelos colegas', onClick: p.onStatus },
    { label: 'Guia de status e cores', hint: 'O que cada cor quer dizer', onClick: p.onGuide },
    { label: 'Perfil e ajustes', hint: 'Foto, tema, avisos, senha', onClick: p.onProfile },
  ];
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-blue-800 bg-blue-950 text-lg font-bold text-blue-600">{p.avatar}</span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-medium text-slate-400">Representante</span>
          <span className="font-display truncate text-[26px] font-extrabold leading-tight tracking-tight text-white">{p.name}</span>
        </div>
      </div>

      <section className="flex items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <ProgressRing value={p.todayDone} total={p.todayTotal} size={88} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Ciclo{p.weekLabel ? ` · ${p.weekLabel}` : ''}</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-white">{pct}% do ciclo</span>
          <span className="text-[13px] text-slate-400">
            {p.cycleDone} de {p.cycleTotal} visitados · faltam {Math.max(0, p.cycleTotal - p.cycleDone)}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {[
          [String(p.weekVisits), 'visitas na semana'],
          [p.perDayAvg, 'média por dia'],
          [String(p.cities), p.cities === 1 ? 'cidade' : 'cidades'],
        ].map(([v, l]) => (
          <div key={l} className="flex flex-col rounded-[18px] border border-slate-800 bg-slate-900 p-3">
            <span className="font-display text-[22px] font-extrabold tabular-nums leading-tight text-white">{v}</span>
            <span className="text-[11px] text-slate-400">{l}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Visitas por dia</h2>
        <div className="grid h-[120px] grid-cols-5 items-end gap-2.5" role="img" aria-label={DAYS.map((d, i) => `${d}: ${p.perDay[i] ?? 0}`).join(', ')}>
          {DAYS.map((d, i) => {
            const v = p.perDay[i] ?? 0;
            return (
              <div key={d} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-semibold tabular-nums text-slate-300">{v > 0 ? v : ''}</span>
                <span className={`w-full rounded-t-lg rounded-b-sm ${i === p.todayIndex ? 'bg-blue-600' : 'bg-blue-800'}`} style={{ height: `${Math.max(4, (v / top) * 72)}px` }} />
                <span className={`text-[11px] font-semibold ${i === p.todayIndex ? 'text-slate-100' : 'text-slate-400'}`}>{d}</span>
              </div>
            );
          })}
        </div>
      </section>

      {p.onCiclo && (
        <button
          type="button"
          onClick={p.onCiclo}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[15px] font-bold text-white active:bg-blue-700"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" />
          </svg>
          Organizar minha rota do ciclo
        </button>
      )}

      <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={r.onClick}
            className="flex min-h-[60px] w-full items-center gap-3 border-0 border-t border-slate-800 bg-transparent px-4 py-2 text-left first:border-t-0 active:bg-slate-800"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-white">{r.label}</span>
              <span className="truncate text-xs text-slate-400">{r.hint}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
