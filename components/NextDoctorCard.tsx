'use client';


import type { Doctor, ExpectedVisit } from '@/types/doctor';
import { formatMinutes, formatPlaceLines } from '@/utils';
import { getLocations, locationShort, todayLocation } from '@/lib/locations';

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
  const locais = getLocations(doc);
  const hoje = locais.length > 1 ? todayLocation(locais) : null;
  return (
    <section
      aria-label={`Próximo médico: ${doc.descricao}`}
      className="flex flex-col gap-3.5 rounded-[28px] border border-blue-800 bg-linear-to-br from-blue-950 to-slate-900 p-[18px]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${inOffice ? 'bg-sky-500 text-slate-950' : 'bg-blue-600 text-white'}`}>
          {inOffice ? 'Você está aqui' : 'Próximo'}
        </span>
      </div>

      <button type="button" onClick={onOpen} className="flex min-h-11 flex-col items-start gap-1 border-0 bg-transparent p-0 text-left">
        <span className="font-display text-[22px] font-extrabold uppercase leading-[1.15] tracking-tight text-white">{doc.descricao}</span>
        <span className="text-[13px] uppercase text-slate-400">{place.line1}</span>
        {place.line2 && <span className="text-[13px] uppercase text-slate-400">{place.line2}</span>}
      </button>

      {(expected || hoje) && (
        <div className="flex flex-wrap gap-2">
          {expected && (
            <span className="flex items-center gap-1.5 rounded-[10px] bg-slate-800 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-100">
              <span className="text-blue-600">{icon('M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z')}</span>
              média {formatMinutes(expected.startMinutes)}
            </span>
          )}
          {hoje && (
            <span className="flex items-center gap-1.5 rounded-[10px] bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100">
              <span className="text-blue-600">{icon('M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z')}</span>
              {locais.length} locais · hoje em {locationShort(hoje)}
            </span>
          )}
        </div>
      )}
      <div className={`grid gap-2 ${onGo ? 'grid-cols-[56px_1fr_1fr]' : 'grid-cols-2'}`}>
        {onGo && (
          <button
            type="button"
            onClick={onGo}
            aria-label="Abrir a rota no mapa"
            className="flex h-14 items-center justify-center rounded-[18px] border border-slate-700 bg-slate-900 text-slate-100"
          >
            {icon('M3 11l18-8-8 18-2-8z')}
          </button>
        )}
        <button
          type="button"
          onClick={onArrive}
          aria-pressed={inOffice}
          className={`h-14 rounded-[18px] text-base font-bold ${
            inOffice ? 'border border-sky-500 bg-sky-500/10 text-sky-400' : 'border-0 bg-blue-600 text-white'
          }`}
        >
          {inOffice ? 'No consultório' : 'Cheguei'}
        </button>
        <button
          type="button"
          onClick={onVisit}
          className={`flex h-14 items-center justify-center gap-2 rounded-[18px] text-base font-bold ${
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
