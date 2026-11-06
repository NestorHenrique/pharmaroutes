'use client';

import type { AgendaEntry, Shift } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_SHIFT } from '@/constants';
import { sortAgenda, dayLabel } from '@/utils';

interface AgendaEditorProps {
  value: AgendaEntry[];
  onChange: (next: AgendaEntry[]) => void;
}

/** Seleciona os dias e, para cada dia marcado, o turno (Manhã, Tarde, Integral, Noite) */
export default function AgendaEditor({ value, onChange }: AgendaEditorProps) {
  const agenda = sortAgenda(value || []);
  const selected = new Map(agenda.map((e) => [e.day, e.shift]));

  const toggleDay = (day: string) => {
    if (selected.has(day)) onChange(agenda.filter((e) => e.day !== day));
    else onChange(sortAgenda([...agenda, { day, shift: 'INTEGRAL' }]));
  };

  const setShift = (day: string, shift: Shift) =>
    onChange(agenda.map((e) => (e.day === day ? { ...e, shift } : e)));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-slate-500 block">Dias e turnos de atendimento:</span>

      <div className="flex gap-1">
        {OPCOES_DIAS.map((d) => {
          const isChecked = selected.has(d.value);
          return (
            <button
              type="button"
              key={d.value}
              aria-pressed={isChecked}
              onClick={() => toggleDay(d.value)}
              className={`flex-1 py-1.5 rounded border text-[10px] font-semibold ${
                isChecked
                  ? 'border-blue-500 bg-blue-700 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-500'
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {agenda.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-slate-800 bg-slate-950/60 p-1.5">
          {agenda.map((e) => (
            <div key={e.day} className="flex items-center gap-1.5">
              <span className="w-8 shrink-0 text-[10px] font-bold text-blue-400">{dayLabel(e.day)}</span>
              <div className="flex flex-1 gap-0.5">
                {OPCOES_SHIFT.map((s) => {
                  const active = e.shift === s.value;
                  return (
                    <button
                      type="button"
                      key={s.value}
                      aria-pressed={active}
                      onClick={() => setShift(e.day, s.value)}
                      className={`flex-1 py-1 rounded text-[10px] border ${
                        active
                          ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-semibold'
                          : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
