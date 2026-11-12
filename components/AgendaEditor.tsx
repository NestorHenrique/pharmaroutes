'use client';

import type { AgendaEntry, Shift } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_SHIFT } from '@/constants';
import { sortAgenda, dayLabel } from '@/utils';
import FormTitle from '@/components/FormTitle';

interface AgendaEditorProps {
  value: AgendaEntry[];
  onChange: (next: AgendaEntry[]) => void;
}

/** Seleciona os dias e, para cada dia marcado, o turno (Manhã, Tarde, Integral) */
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
      <FormTitle>Dias e turno</FormTitle>

      <div className="grid grid-cols-5 gap-1.5">
        {OPCOES_DIAS.map((d) => {
          const isChecked = selected.has(d.value);
          return (
            <button
              type="button"
              key={d.value}
              aria-pressed={isChecked}
              onClick={() => toggleDay(d.value)}
              className={`flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs ${
                isChecked
                  ? 'border border-blue-600 bg-blue-900 font-bold text-blue-200'
                  : 'border border-slate-700 bg-slate-950 font-semibold text-slate-400'
              }`}
            >
              {d.label}
              {isChecked && <span className="text-[10px] font-medium">{OPCOES_SHIFT.find((s) => s.value === selected.get(d.value))?.label}</span>}
            </button>
          );
        })}
      </div>

      {agenda.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[14px] border border-slate-700 bg-slate-950 p-3">
          <span className="text-xs text-slate-500">Toque no dia e escolha o turno em que o médico atende.</span>
          {agenda.map((e) => (
            <div key={e.day} className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[13px] font-bold text-blue-200">{dayLabel(e.day)}</span>
              <div className="grid flex-1 gap-0.5 rounded-xl border border-slate-700 bg-slate-900 p-0.5" style={{ gridTemplateColumns: `repeat(${OPCOES_SHIFT.filter((s) => s.value !== 'NOITE' || e.shift === 'NOITE').length}, minmax(0, 1fr))` }}>
                {OPCOES_SHIFT.filter((s) => s.value !== 'NOITE' || e.shift === 'NOITE').map((s) => {
                  const active = e.shift === s.value;
                  return (
                    <button
                      type="button"
                      key={s.value}
                      aria-pressed={active}
                      onClick={() => setShift(e.day, s.value)}
                      className={`h-11 rounded-[10px] border-0 text-xs ${
                        active ? 'bg-blue-600 font-bold text-slate-950' : 'bg-transparent font-semibold text-slate-400'
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
