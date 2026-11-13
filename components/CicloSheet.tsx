'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { Doctor } from '@/types/doctor';
import { normalizeCycleWeeks, CYCLE_WEEKS } from '@/types/doctor';
import { specialtyCode } from '@/utils';

interface CicloSheetProps {
  doctors: Doctor[];
  onClose: () => void;
  onOpen: (id: string) => void;
}

const DAYS = [
  { code: 'segunda', label: 'Seg' },
  { code: 'terca', label: 'Ter' },
  { code: 'quarta', label: 'Qua' },
  { code: 'quinta', label: 'Qui' },
  { code: 'sexta', label: 'Sex' },
] as const;

type DayCode = (typeof DAYS)[number]['code'];

function getDoctorsForWeekDay(doctors: Doctor[], week: number, day: DayCode): Doctor[] {
  return doctors.filter((d) => {
    const weeks = normalizeCycleWeeks(d.cycle_weeks);
    if (!weeks.includes(week as (typeof CYCLE_WEEKS)[number])) return false;
    if (!d.agenda || d.agenda.length === 0) return false;
    return d.agenda.some((e) => e.day === day);
  });
}

/** Tela de organização do ciclo: semana × dia → lista ordenada de médicos. */
export default function CicloSheet({ doctors, onClose, onOpen }: CicloSheetProps) {
  const [week, setWeek] = useState<number>(1);
  const [day, setDay] = useState<DayCode>('segunda');

  const list = getDoctorsForWeekDay(doctors, week, day);
  const dayCounts = DAYS.map((d) => getDoctorsForWeekDay(doctors, week, d.code).length);

  return (
    <BottomSheet title="Organizar rota do ciclo" onClose={onClose}>
      {/* semanas */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar pb-1">
        {CYCLE_WEEKS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWeek(w)}
            aria-pressed={week === w}
            className={`flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold ${
              week === w
                ? 'bg-blue-600 text-white'
                : 'border border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            {w}ª semana
          </button>
        ))}
      </div>

      {/* dias da semana */}
      <div className="grid grid-cols-5 gap-1.5">
        {DAYS.map((d, i) => (
          <button
            key={d.code}
            type="button"
            onClick={() => setDay(d.code)}
            aria-pressed={day === d.code}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-[14px] py-2.5 text-[13px] font-bold ${
              day === d.code
                ? 'bg-blue-600 text-white'
                : 'border border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            {d.label}
            <span className={`text-[11px] font-semibold ${day === d.code ? 'opacity-80' : 'text-slate-500'}`}>
              {dayCounts[i]}
            </span>
          </button>
        ))}
      </div>

      {/* lista de médicos do dia */}
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M3 10h18M8 2v4M16 2v4" />
          </svg>
          <p className="text-[13px] text-slate-500">
            Nenhum médico neste dia.
            <br />
            Edite a agenda do médico para adicioná-lo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              {DAYS.find((d) => d.code === day)?.label} · {list.length} {list.length === 1 ? 'médico' : 'médicos'}
            </span>
            <span className="text-[11px] text-slate-500">Toque para abrir a ficha</span>
          </div>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800">
            {list.map((doc, i) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => { onClose(); onOpen(doc.id); }}
                className="flex min-h-[60px] w-full items-center gap-3 border-0 border-t border-slate-800 bg-slate-900 px-4 py-2 text-left first:border-t-0 active:bg-slate-800"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-800 text-[12px] font-bold text-slate-400 tabular-nums">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold uppercase text-white">{doc.descricao}</span>
                  <span className="truncate text-xs uppercase text-slate-400">
                    {[specialtyCode(doc.especialidade), doc.complemento, doc.cidade].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
