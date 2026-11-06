'use client';

import { useEffect, useRef, useState } from 'react';
import type { CityOption } from '@/utils';
import { normalizeText } from '@/utils';

interface CityFilterProps {
  options: CityOption[];
  /** chaves (cityKey) marcadas; vazio = todas */
  selected: string[];
  onChange: (keys: string[]) => void;
}

/** Filtro de cidades: busca enquanto digita + lista com caixas de marcar */
export default function CityFilter({ options, selected, onChange }: CityFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const q = normalizeText(query);
  const filtered = q ? options.filter((o) => o.value.includes(q)) : options;
  const selectedSet = new Set(selected);

  const toggle = (key: string) =>
    onChange(selectedSet.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const labelFor = (key: string) => options.find((o) => o.value === key)?.label ?? key;
  const summary =
    selected.length === 0
      ? 'Todas as cidades'
      : selected.length === 1
        ? labelFor(selected[0]).toUpperCase()
        : `${selected.length} cidades`;

  return (
    <div ref={ref} className="relative mb-2">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Filtrar por cidade"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded border bg-slate-900 p-2 text-xs ${
          selected.length > 0 ? 'border-sky-500 text-sky-300' : 'border-slate-700 text-slate-100'
        }`}
      >
        <span className="truncate">📍 {summary}</span>
        <span className="text-[10px] text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-slate-700 bg-slate-900 shadow-xl shadow-black/40">
          <div className="flex gap-1.5 border-b border-slate-800 p-1.5">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cidade..."
              aria-label="Buscar cidade"
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-800 p-1.5 text-[11px] text-slate-100 outline-hidden placeholder:text-slate-500"
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="shrink-0 rounded border border-slate-700 px-2 text-[10px] text-slate-400 hover:text-red-400"
              >
                Limpar
              </button>
            )}
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-2.5 py-1.5 text-[11px] text-slate-500">Nada encontrado</li>}
            {filtered.map((o) => {
              const checked = selectedSet.has(o.value);
              return (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                      className="size-3.5 accent-sky-500"
                    />
                    <span className="flex-1 truncate">{o.label}</span>
                    <span className="text-[10px] text-slate-500">{o.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
