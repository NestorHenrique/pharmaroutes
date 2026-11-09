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
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 block">Dias e turnos</span>

      <div className="flex gap-1">
        {OPCOES_DIAS.map((d) => {
          const isChecked = selected.has(d.value);
          return (
            <button
              type="button"
              key={d.value}
              aria-pressed={isChecked}
              onClick={() => toggleDay(d.value)}
              className={`flex-1 h-10 rounded-xl text-xs font-semibold ${
                isChecked
                  ? 'border-0 bg-blue-600 text-white'
                  : 'border border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {agenda.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-2">
          {agenda.map((e) => (
            <div key={e.day} className="flex items-center gap-1.5">
              <span className="w-9 shrink-0 text-xs font-bold text-slate-200">{dayLabel(e.day)}</span>
              <div className="flex flex-1 gap-1">
                {OPCOES_SHIFT.map((s) => {
                  const active = e.shift === s.value;
                  return (
                    <button
                      type="button"
                      key={s.value}
                      aria-pressed={active}
                      onClick={() => setShift(e.day, s.value)}
                      className={`flex-1 h-9 rounded-lg text-xs ${
                        active
                          ? 'border-0 bg-slate-100 text-slate-950 font-semibold'
                          : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
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
