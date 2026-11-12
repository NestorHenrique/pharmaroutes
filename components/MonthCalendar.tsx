'use client';

import { useState } from 'react';

/* ── Datas em texto "aaaa-mm-dd" (sem fuso: o dia que o usuário vê é o dia salvo) ── */

export function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface MonthCalendarProps {
  /** dia escolhido ("aaaa-mm-dd") ou vazio */
  value: string;
  /** primeiro dia que pode ser escolhido */
  min: string;
  onChange: (iso: string) => void;
}

/** Calendário mensal: dias de 44 px, sem datas passadas */
export default function MonthCalendar({ value, min, onChange }: MonthCalendarProps) {
  const anchor = fromIso(value || min);
  const [view, setView] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));

  const minDate = fromIso(min);
  const firstOfMin = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoBack = view.getTime() > firstOfMin.getTime();

  const startOffset = view.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const rawTitle = view.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  // "novembro de 2026" -> "Novembro de 2026" (só a primeira letra; o CSS capitalize poria "De")
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const move = (delta: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          aria-label="Mês anterior"
          disabled={!canGoBack}
          onClick={() => move(-1)}
          className="flex size-11 items-center justify-center rounded-xl border-0 bg-transparent text-slate-200 disabled:opacity-30"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-100" aria-live="polite">
          {title}
        </span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => move(1)}
          className="flex size-11 items-center justify-center rounded-xl border-0 bg-transparent text-slate-200"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 text-center" role="grid" aria-label={title}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-1 text-[11px] font-semibold text-slate-500" aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const iso = toIso(new Date(view.getFullYear(), view.getMonth(), day));
          const disabled = iso < min;
          const selected = iso === value;
          const today = iso === toIso(new Date());
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={fromIso(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => onChange(iso)}
              className={`mx-auto flex size-10 items-center justify-center rounded-[10px] border-0 text-sm tabular-nums ${
                selected
                  ? 'bg-blue-600 font-bold text-white'
                  : disabled
                    ? `bg-transparent text-slate-600${today ? ' border border-blue-800' : ''}`
                    : 'bg-transparent text-slate-300 hover:bg-slate-800'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
