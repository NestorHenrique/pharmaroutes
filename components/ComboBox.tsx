'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeText } from '@/utils';

export interface ComboOption {
  value: string;
  label: string;
  /** texto pequeno à direita (sigla, contagem...) */
  hint?: string;
}

interface ComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  ariaLabel?: string;
  /** permite texto que não está na lista (ex.: cidade nova) */
  allowCustom?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Campo com busca enquanto digita (sem acento: "parnaiba" acha "Parnaíba").
 * Ao sair do campo, se o texto bate com uma opção, usa a grafia da opção.
 */
export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  allowCustom = true,
  size = 'md',
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const q = normalizeText(open ? query : '');
  const filtered = q
    ? options.filter((o) => normalizeText(o.label).includes(q) || normalizeText(o.hint).includes(q))
    : options;

  /** Fecha e encaixa o texto digitado na grafia oficial, se existir */
  function close() {
    setOpen(false);
    const key = normalizeText(value);
    if (!key) return;
    const match = options.find((o) => normalizeText(o.label) === key || normalizeText(o.value) === key);
    if (match && match.value !== value) onChange(match.value);
    else if (!match && !allowCustom) onChange('');
  }

  const pick = (o: ComboOption) => {
    onChange(o.value);
    setQuery('');
    setOpen(false);
  };

  const pad = size === 'sm' ? 'h-10 px-3 text-base sm:text-sm' : 'h-11 px-3.5 text-base sm:text-sm';

  return (
    <div ref={ref} className="relative min-w-0">
      <div className="flex">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          autoComplete="off"
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && open && filtered.length > 0 && query) {
              e.preventDefault();
              pick(filtered[0]);
            }
          }}
          className={`w-full min-w-0 box-border rounded-l-xl border border-slate-700 bg-slate-950 text-slate-100 outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600 ${pad}`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Abrir lista"
          onClick={() => {
            setQuery('');
            setOpen((o) => !o);
          }}
          className="shrink-0 rounded-r-xl border border-l-0 border-slate-700 bg-slate-950 px-3 text-xs text-slate-400 hover:text-white"
        >
          ▾
        </button>
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40"
        >
          {filtered.length === 0 && (
            <li className="px-2.5 py-1.5 text-[11px] text-slate-500">
              {allowCustom && value.trim() ? `Novo: "${value.trim()}"` : 'Nada encontrado'}
            </li>
          )}
          {filtered.map((o) => {
            const selected = normalizeText(o.value) === normalizeText(value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] hover:bg-slate-800 ${
                    selected ? 'text-sky-300 font-semibold' : 'text-slate-200'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[10px] font-bold text-slate-500">{o.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
