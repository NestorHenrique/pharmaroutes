'use client';

import MonthCalendar, { fromIso, toIso } from '@/components/MonthCalendar';

/** Amanhã: a volta não pode ser hoje, senão o médico ficaria ausente zero dias */
export function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toIso(d);
}

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Mesmo dia do mês que vem (31 de janeiro + 1 mês = 28/29 de fevereiro) */
function inOneMonth(): string {
  const d = new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toIso(d);
}

const SHORTCUTS = [
  { label: '1 semana', get: () => inDays(7) },
  { label: '2 semanas', get: () => inDays(14) },
  { label: '1 mês', get: inOneMonth },
] as const;

function longDate(iso: string): string {
  return fromIso(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function dayBefore(iso: string): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface ReturnDatePickerProps {
  value: string;
  onChange: (iso: string) => void;
}

/**
 * "Até quando?": atalhos (1 semana, 2 semanas, 1 mês), campo de data e calendário mensal.
 * O médico fica como ausente até o dia anterior à volta e volta sozinho à rota na data escolhida.
 */
export default function ReturnDatePicker({ value, onChange }: ReturnDatePickerProps) {
  const min = tomorrowIso();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Atalhos">
        {SHORTCUTS.map((s) => {
          const iso = s.get();
          const on = iso === value;
          return (
            <button
              key={s.label}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(iso)}
              className={`h-11 shrink-0 rounded-full px-4 text-sm ${
                on
                  ? 'border-0 bg-slate-100 font-semibold text-slate-950'
                  : 'border border-slate-700 bg-transparent text-slate-200 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Volta em</span>
        <input
          type="date"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value >= min ? e.target.value : '')}
          className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 outline-hidden focus-visible:border-blue-600"
        />
      </label>

      <MonthCalendar value={value} min={min} onChange={onChange} />

      <p className="m-0 min-h-10 text-sm leading-snug text-slate-400" aria-live="polite">
        {value ? (
          <>
            Volta <strong className="text-slate-100">{longDate(value)}</strong>. Fica como ausente até {dayBefore(value)};
            na data da volta o médico entra sozinho na rota.
          </>
        ) : (
          'Escolha um atalho ou um dia no calendário.'
        )}
      </p>
    </div>
  );
}
