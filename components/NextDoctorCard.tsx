'use client';


import type { Doctor, ExpectedVisit } from '@/types/doctor';
import { formatMinutes, formatPlaceLines, specialtyCode } from '@/utils';
import { useEffect, useState } from 'react';
import type { DoctorLocation } from '@/types/doctor';
import { agendaSummary, getLocations, locationForDay, locationShort } from '@/lib/locations';

interface NextDoctorCardProps {
  doc: Doctor;
  expected?: ExpectedVisit | null;
  /** o próprio rep já marcou "Rep. no consultório" neste médico */
  inOffice: boolean;
  /** dia da rota ("ter", "qua"...): escolhe o local padrão de quem atende em mais de um lugar */
  day: string;
  /** local gravado no meu "Rep. no consultório" (null = Local 1) */
  markedLocationId?: string | null;
  /** abre o Maps no local escolhido; ausente = médico sem GPS nem endereço */
  onGo?: ((loc: DoctorLocation) => void) | null;
  onOpen: () => void;
  /** abre a folha "Marcar status" (grade de status) */
  onStatus: () => void;
  onArrive: (loc: DoctorLocation) => void;
  onVisit: () => void;
  /** já está no consultório e trocou o local: corrige o status gravado */
  onFixLocation?: (loc: DoctorLocation) => void;
  /** versão baixa para a aba Mapa: nome em 1 linha, sem média e sem "Outro status" */
  compact?: boolean;
}

const DAY_NAME: Record<string, string> = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', sab: 'sábado', dom: 'domingo' };

const icon = (d: string, w = 2) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Card grande do topo da rota: diz para onde ir agora e resolve a visita em um toque. */
export default function NextDoctorCard({ doc, expected, inOffice, day, markedLocationId, onGo, onOpen, onStatus, onArrive, onVisit, onFixLocation, compact = false }: NextDoctorCardProps) {
  const locais = getLocations(doc);
  const multi = locais.length > 1;
  // Padrão: o local que atende no dia em que o rep colocou o médico; já no consultório, o local gravado no status
  const marked = inOffice ? locais.find((l) => (markedLocationId ? l.id === markedLocationId : l.principal)) ?? null : null;
  const fallback = marked ?? locationForDay(locais, day);
  const [pickedId, setPickedId] = useState<string | null>(null);
  useEffect(() => setPickedId(null), [doc.id, day, inOffice, markedLocationId]);
  const loc = locais.find((l) => l.id === pickedId) ?? fallback;
  const place = multi
    ? {
        line1: [specialtyCode(doc.especialidade), loc.nome].filter(Boolean).join(' · ').toUpperCase(),
        line2: [loc.bairro, loc.cidade].filter(Boolean).join(' · ').toUpperCase(),
      }
    : formatPlaceLines(doc);
  const pick = (l: DoctorLocation) => {
    setPickedId(l.id);
    if (inOffice && l.id !== fallback.id) onFixLocation?.(l);
  };
  return (
    <section
      aria-label={`Próximo médico: ${doc.descricao}`}
      className={`flex flex-col rounded-[28px] border border-blue-800 bg-linear-to-br from-blue-950 to-slate-900 ${compact ? 'gap-2.5 p-3.5' : 'gap-3.5 p-[18px]'}`}
    >
      {compact ? (
        <button type="button" onClick={onOpen} className="flex min-h-11 min-w-0 flex-col items-start gap-0.5 border-0 bg-transparent p-0 text-left">
          <span className="flex w-full min-w-0 items-center gap-2">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${inOffice ? 'bg-sky-500 text-slate-950' : 'bg-blue-600 text-white'}`}>
              {inOffice ? 'Aqui' : 'Próximo'}
            </span>
            <span className="font-display min-w-0 truncate text-[17px] font-extrabold uppercase leading-tight text-white">{doc.descricao} ›</span>
          </span>
          <span className="w-full truncate text-xs uppercase text-slate-400">
            {[place.line1, place.line2].filter(Boolean).join(' · ')}
          </span>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${inOffice ? 'bg-sky-500 text-slate-950' : 'bg-blue-600 text-white'}`}>
              {inOffice ? 'Você está aqui' : 'Próximo'}
            </span>
          </div>

          <button type="button" onClick={onOpen} className="flex min-h-11 flex-col items-start gap-1 border-0 bg-transparent p-0 text-left">
            <span className="font-display text-[22px] font-extrabold uppercase leading-[1.15] tracking-tight text-white">{doc.descricao} ›</span>
            <span className="text-[13px] uppercase text-slate-400">{place.line1}</span>
            {place.line2 && <span className="text-[13px] uppercase text-slate-400">{place.line2}</span>}
          </button>
        </>
      )}

      {multi && (
        <div className="flex flex-col gap-1.5">
          {!compact && (
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              {inOffice ? 'Você está em' : 'Onde vai visitar'}
            </span>
          )}
          <div className={`gap-2 ${locais.length === 2 ? 'grid grid-cols-2' : '-mx-[18px] flex overflow-x-auto px-[18px] no-scrollbar'}`}>
            {locais.map((l) => {
              const on = l.id === loc.id;
              const ofDay = l.agenda.some((e) => e.day === day);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => pick(l)}
                  aria-pressed={on}
                  className={`flex ${compact ? 'min-h-11' : 'min-h-[52px]'} min-w-0 shrink-0 flex-col items-start justify-center rounded-[14px] px-3 py-1.5 text-left ${
                    locais.length === 2 ? '' : 'w-[150px]'
                  } ${on ? 'border-2 border-blue-600 bg-blue-900' : 'border border-slate-700 bg-slate-900'}`}
                >
                  <span className={`w-full truncate text-[13px] font-bold ${on ? 'text-blue-200' : 'text-slate-100'}`}>{locationShort(l)}</span>
                  <span className={`w-full truncate text-[11px] ${on ? 'text-blue-300' : 'text-slate-400'}`}>
                    {ofDay ? `Local da ${DAY_NAME[day] ?? day}` : agendaSummary(l.agenda)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {expected && !compact && (
        <div className="flex flex-wrap gap-2">
          {expected && (
            <span className="flex items-center gap-1.5 rounded-[10px] bg-slate-800 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-100">
              <span className="text-blue-600">{icon('M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z')}</span>
              média {formatMinutes(expected.startMinutes)}
            </span>
          )}
        </div>
      )}
      <div className={`grid gap-2 ${onGo ? (compact ? 'grid-cols-[48px_1fr_1fr]' : 'grid-cols-[56px_1fr_1fr]') : 'grid-cols-2'}`}>
        {onGo && (
          <button
            type="button"
            onClick={() => onGo(loc)}
            aria-label={multi ? `Abrir a rota até ${loc.nome}` : 'Abrir a rota no mapa'}
            className={`flex ${compact ? 'h-12' : 'h-14'} items-center justify-center rounded-[18px] border border-slate-700 bg-slate-900 text-slate-100`}
          >
            {icon('M3 11l18-8-8 18-2-8z')}
          </button>
        )}
        <button
          type="button"
          onClick={() => onArrive(loc)}
          aria-pressed={inOffice}
          className={`${compact ? 'h-12' : 'h-14'} rounded-[18px] text-base font-bold ${
            inOffice ? 'border border-sky-500 bg-sky-500/10 text-sky-400' : 'border-0 bg-blue-600 text-white'
          }`}
        >
          {inOffice ? 'No consultório' : 'Cheguei'}
        </button>
        <button
          type="button"
          onClick={onVisit}
          className={`flex ${compact ? 'h-12' : 'h-14'} items-center justify-center gap-2 rounded-[18px] text-base font-bold ${
            inOffice ? 'border-0 bg-emerald-500 text-slate-950' : 'border border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {icon('M5 12l5 5L20 7', 2.6)}
          Visitei
        </button>
      </div>

      {!compact && (
      <button type="button" onClick={onStatus} className="flex h-11 items-center gap-1.5 self-center border-0 bg-transparent px-3 text-[13px] font-semibold text-blue-400">
        {icon('M5 21V4M5 4h11l-2.5 4L16 12H5', 2)}
        Outro status
      </button>
      )}
    </section>
  );
}
