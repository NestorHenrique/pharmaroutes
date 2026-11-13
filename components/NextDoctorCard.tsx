'use client';

import type { Doctor, ExpectedVisit } from '@/types/doctor';
import { formatMinutes, formatPlaceLines } from '@/utils';

interface NextDoctorCardProps {
  doc: Doctor;
  expected?: ExpectedVisit | null;
  /** o próprio rep já marcou "Rep. no consultório" neste médico */
  inOffice: boolean;
  /** abre o Maps; ausente = médico sem GPS nem endereço */
  onGo?: (() => void) | null;
  onOpen: () => void;
  onArrive: () => void;
  onVisit: () => void;
}

const icon = (d: string, w = 2) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Card grande do topo da rota: diz para onde ir agora e resolve a visita em um toque. */
export default function NextDoctorCard({ doc, expected, inOffice, onGo, onOpen, onArrive, onVisit }: NextDoctorCardProps) {
  const place = formatPlaceLines(doc);
  return (
    <section
      aria-label={`Próximo médico: ${doc.descricao}`}
      className="flex flex-col gap-3.5 rounded-3xl border border-blue-800 bg-linear-to-br from-blue-950 to-slate-900 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${inOffice ? 'bg-sky-500 text-slate-950' : 'bg-blue-600 text-white'}`}>
          {inOffice ? 'Você está aqui' : 'Próximo'}
        </span>
        {expected && (
          <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-slate-200">
            <span className="text-blue-600">{icon('M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z')}</span>
            {formatMinutes(expected.startMinutes)}
            <span className="font-medium text-slate-400">média</span>
          </span>
        )}
      </div>

      <button type="button" onClick={onOpen} className="flex min-h-11 flex-col items-start gap-1 border-0 bg-transparent p-0 text-left">
        <span className="text-xl font-bold uppercase leading-tight tracking-tight text-white">{doc.descricao}</span>
        <span className="text-[13px] uppercase text-slate-400">{place.line1}</span>
        {place.line2 && <span className="text-[13px] uppercase text-slate-400">{place.line2}</span>}
      </button>

      <div className={`grid gap-2 ${onGo ? 'grid-cols-[52px_1fr_1fr]' : 'grid-cols-2'}`}>
        {onGo && (
          <button
            type="button"
            onClick={onGo}
            aria-label="Abrir a rota no mapa"
            className="flex h-[52px] items-center justify-center rounded-[14px] border border-slate-700 bg-slate-900 text-slate-100"
          >
            {icon('M3 11l18-8-8 18-2-8z')}
          </button>
        )}
        <button
          type="button"
          onClick={onArrive}
          aria-pressed={inOffice}
          className={`h-[52px] rounded-[14px] text-base font-bold ${
            inOffice ? 'border border-sky-500 bg-sky-500/10 text-sky-400' : 'border-0 bg-blue-600 text-white'
          }`}
        >
          {inOffice ? 'No consultório' : 'Cheguei'}
        </button>
        <button
          type="button"
          onClick={onVisit}
          className={`flex h-[52px] items-center justify-center gap-2 rounded-[14px] text-base font-bold ${
            inOffice ? 'border-0 bg-emerald-500 text-slate-950' : 'border border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {icon('M5 12l5 5L20 7', 2.6)}
          Visitei
        </button>
      </div>

      <button type="button" onClick={onOpen} className="h-11 self-center border-0 bg-transparent px-3 text-[13px] font-semibold text-blue-400">
        Outro status ou ficha
      </button>
    </section>
  );
}
