'use client';

import { lockScroll } from '@/lib/scrollLock';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeText } from '@/utils';

export interface PickerOption {
  value: string;
  label: string;
  /** texto pequeno à direita (sigla, contagem...) */
  hint?: string;
}

interface PickerSheetProps {
  title: string;
  options: PickerOption[];
  /** valor atual (marca a opção correspondente) */
  value: string;
  /** texto que não está na lista pode ser usado (ex.: cidade nova) */
  allowCustom?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/**
 * Seletor em folha por baixo (renderizado no <body>, então nunca fica preso dentro de cabeçalho
 * ou formulário): busca sem acento, lista grande para o toque, Cancelar e Limpar.
 */
export default function PickerSheet({
  title,
  options,
  value,
  allowCustom = false,
  searchPlaceholder = 'Buscar...',
  onSelect,
  onClose,
}: PickerSheetProps) {
  const [query, setQuery] = useState('');

  // Esc fecha; a página por trás não rola
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [onClose]);

  const q = normalizeText(query);
  const filtered = useMemo(
    () =>
      q ? options.filter((o) => normalizeText(o.label).includes(q) || normalizeText(o.hint).includes(q)) : options,
    [options, q],
  );
  const exact = q ? options.some((o) => normalizeText(o.label) === q || normalizeText(o.value) === q) : true;
  const current = normalizeText(value);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-[fade-in_.18s_ease-out]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-[28px] border-t border-slate-700 bg-slate-900 animate-[sheet-up_.24s_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-slate-700" aria-hidden="true" />

        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <h2 className="m-0 text-xl font-bold tracking-tight text-white">{title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-transparent text-slate-200 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-base text-slate-100 outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600 sm:text-sm"
          />
        </div>

        <ul role="listbox" className="m-0 mt-2 min-h-0 flex-1 list-none overflow-y-auto px-2 py-0">
          {allowCustom && query.trim() && !exact && (
            <li>
              <button
                type="button"
                onClick={() => onSelect(query.trim())}
                className="flex min-h-12 w-full items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-left text-[15px] font-semibold text-blue-400 hover:bg-slate-800"
              >
                + Usar “{query.trim()}”
              </button>
            </li>
          )}
          {filtered.length === 0 && !(allowCustom && query.trim()) && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">Nada encontrado</li>
          )}
          {filtered.map((o) => {
            const selected = normalizeText(o.value) === current || normalizeText(o.label) === current;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(o.value)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl border-0 px-3 py-2 text-left ${
                    selected ? 'bg-sky-500/10' : 'bg-transparent hover:bg-slate-800'
                  }`}
                >
                  <span className={`flex-1 truncate text-[15px] ${selected ? 'font-semibold text-sky-300' : 'text-slate-100'}`}>
                    {o.label}
                  </span>
                  {o.hint && <span className="shrink-0 text-xs font-bold text-slate-400">{o.hint}</span>}
                  {selected && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-sky-300" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          className="grid shrink-0 gap-2 border-t border-slate-800 px-5 pt-3"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
            gridTemplateColumns: value ? '1fr 1fr' : '1fr',
          }}
        >
          {value && (
            <button
              type="button"
              onClick={() => onSelect('')}
              className="h-12 rounded-2xl border border-slate-700 bg-transparent text-sm font-semibold text-slate-300 hover:text-red-400"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
