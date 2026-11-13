'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { Doctor } from '@/types/doctor';
import { CYCLE_WEEKS } from '@/types/doctor';
import { getAgenda, specialtyCode } from '@/utils';

interface CicloSheetProps {
  doctors: Doctor[];
  /** semanas do ciclo de cada médico (vêm de rep_route_order, por representante) */
  weeksByDoctor: ReadonlyMap<string, readonly number[]>;
  /** ordem da rota de uma semana (ids dos médicos) */
  orderOf: (week: number) => readonly string[];
  onMoveUp: (week: number, docId: string, prevId: string) => void;
  onMoveWeek: (docId: string, from: number, to: number) => void;
  onRemoveWeek: (docId: string, from: number) => void;
  onClose: () => void;
  onOpen: (id: string) => void;
}

const DAYS = [
  { code: 'seg', label: 'Seg' },
  { code: 'ter', label: 'Ter' },
  { code: 'qua', label: 'Qua' },
  { code: 'qui', label: 'Qui' },
  { code: 'sex', label: 'Sex' },
] as const;

type DayCode = (typeof DAYS)[number]['code'];

/** Todos os médicos que atendem no dia (em qualquer local), qualquer que seja o status ou a semana do ciclo.
 *  Os da semana escolhida vêm primeiro, na ordem da rota; os outros vêm depois. */
function getDoctorsForDay(
  doctors: Doctor[],
  weeksByDoctor: ReadonlyMap<string, readonly number[]>,
  week: number,
  day: DayCode,
  order: readonly string[] = [],
): Doctor[] {
  const pos = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const inWeek = (d: Doctor) => (weeksByDoctor.get(d.id) ?? []).includes(week);
  return doctors
    .filter((d) => {
    if (getAgenda(d).some((e) => e.day === day)) return true;
    return (d.locais ?? []).some((l) => l.agenda.some((e) => e.day === day));
    })
    .sort((a, b) => Number(inWeek(b)) - Number(inWeek(a)) || pos(a.id) - pos(b.id));
}

/** Tela de organização do ciclo: semana × dia → lista ordenada de médicos. */
export default function CicloSheet({ doctors, weeksByDoctor, orderOf, onMoveUp, onMoveWeek, onRemoveWeek, onClose, onOpen }: CicloSheetProps) {
  const [week, setWeek] = useState<number>(1);
  const [day, setDay] = useState<DayCode>('seg');

  const [moving, setMoving] = useState<Doctor | null>(null);
  const inWeek = (d: Doctor) => (weeksByDoctor.get(d.id) ?? []).includes(week);
  const list = getDoctorsForDay(doctors, weeksByDoctor, week, day, orderOf(week));
  const weekCount = list.filter(inWeek).length;
  const dayCounts = DAYS.map((d) => getDoctorsForDay(doctors, weeksByDoctor, week, d.code).length);

  return (
    <>
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
            Nenhum médico atende neste dia.
            <br />
            Edite a agenda do médico para adicioná-lo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              {DAYS.find((d) => d.code === day)?.label} · {list.length} {list.length === 1 ? 'médico' : 'médicos'} · {weekCount} na {week}ª semana
            </span>
            <span className="text-[11px] text-slate-500">Toque para abrir a ficha</span>
          </div>
          <div className="flex flex-col gap-2">
            {list.map((doc, i) => (
              <div key={doc.id} className={`flex min-h-[60px] items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 py-1.5 pl-3.5 pr-2 ${inWeek(doc) ? '' : 'opacity-75'}`}>
                <span className="font-display grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-slate-700 text-[13px] font-bold tabular-nums text-slate-100">
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => { onClose(); onOpen(doc.id); }}
                  className="flex min-h-11 min-w-0 flex-1 flex-col items-start gap-0.5 border-0 bg-transparent p-0 text-left"
                >
                  <span className="w-full truncate text-sm font-bold uppercase text-white">{doc.descricao}</span>
                  <span className="w-full truncate text-xs uppercase text-slate-400">
                    {[specialtyCode(doc.especialidade), doc.complemento, doc.cidade].filter(Boolean).join(' · ')}
                  </span>
                  {!inWeek(doc) && <span className="text-[11px] font-semibold text-slate-500">Fora da {week}ª semana</span>}
                </button>
                {inWeek(doc) && (
                  <>
                    <button
                      type="button"
                      aria-label="Subir na rota"
                      disabled={i === 0 || !inWeek(list[i - 1])}
                      onClick={() => onMoveUp(week, doc.id, list[i - 1].id)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl border-0 bg-slate-800 text-base text-slate-100 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Mover para outra semana"
                      onClick={() => setMoving(doc)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl border-0 bg-slate-800 text-base text-slate-100"
                    >
                      ⇄
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>

      {moving && (
        <BottomSheet title="Mover médico" onClose={() => setMoving(null)}>
          <span className="-mt-2 truncate text-[13px] uppercase text-slate-400">{moving.descricao}</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Outra semana do ciclo</span>
          <div className="grid grid-cols-5 gap-1.5">
            {CYCLE_WEEKS.map((w) => (
              <button
                key={w}
                type="button"
                disabled={w === week}
                onClick={() => {
                  onMoveWeek(moving.id, week, w);
                  setMoving(null);
                }}
                className="h-14 rounded-[14px] border border-slate-800 bg-slate-900 text-[13px] font-bold text-slate-100 disabled:opacity-35"
              >
                {w}ª
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onRemoveWeek(moving.id, week);
              setMoving(null);
            }}
            className="h-11 self-start border-0 bg-transparent px-1 text-sm font-semibold text-red-500"
          >
            Tirar desta semana
          </button>
          <span className="text-xs text-slate-500">O dia de atendimento vem da agenda do médico. Para mudar o dia, edite a agenda.</span>
        </BottomSheet>
      )}
    </>
  );
}
