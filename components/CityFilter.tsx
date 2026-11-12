'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CityOption } from '@/utils';
import { normalizeText, prettyCity } from '@/utils';

interface CityFilterProps {
  options: CityOption[];
  /** chaves (cityKey) marcadas; vazio = todas */
  selected: string[];
  onChange: (keys: string[]) => void;
  /** médicos de cada cidade no dia escolhido (chave = cityKey); ausente = sem divisão por dia */
  dayCounts?: Record<string, number>;
  /** nome do dia para os títulos ("terça") */
  dayLabel?: string;
  /**
   * Modo "escolher cidades" (ex.: avisos da semana): vazio = nenhuma, sem contagem de médicos.
   * Sem isto o componente é o filtro da lista (vazio = todas as cidades).
   */
  pickMode?: boolean;
  /** desenha o próprio botão que abre a folha (recebe abrir() e o resumo) */
  renderTrigger?: (open: () => void, summary: string) => ReactNode;
}

/** Filtro de cidades: botão que abre uma folha por baixo, com busca, "marcar as do dia" e Aplicar */
export default function CityFilter({ options, selected, onChange, dayCounts, dayLabel, pickMode = false, renderTrigger }: CityFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const [query, setQuery] = useState('');

  const openSheet = () => {
    setDraft(selected);
    setQuery('');
    setOpen(true);
  };

  // Esc fecha; a página por trás não rola
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const labelFor = (key: string) => prettyCity(options.find((o) => o.value === key)?.label ?? key);
  const hasDay = Boolean(dayCounts);
  const todayOf = (key: string) => dayCounts?.[key] ?? 0;

  const q = normalizeText(query);
  const visible = q ? options.filter((o) => o.value.includes(q)) : options;
  const withDoctors = hasDay ? visible.filter((o) => todayOf(o.value) > 0) : visible;
  const withoutDoctors = hasDay ? visible.filter((o) => todayOf(o.value) === 0) : [];

  const draftSet = useMemo(() => new Set(draft), [draft]);
  const toggle = (key: string) =>
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const markDayCities = () =>
    setDraft(options.filter((o) => todayOf(o.value) > 0).map((o) => o.value));

  const resultCount = (draft.length ? draft : options.map((o) => o.value)).reduce(
    (sum, key) => sum + (hasDay ? todayOf(key) : options.find((o) => o.value === key)?.count ?? 0),
    0,
  );

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const emptyLabel = pickMode ? 'Escolher cidades' : 'Todas as cidades';
  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? labelFor(selected[0])
        : `${selected.length} cidades`;

  const row = (o: CityOption, showDay: boolean) => {
    const checked = draftSet.has(o.value);
    return (
      <li key={o.value}>
        <label
          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${
            checked ? 'bg-sky-500/10' : 'hover:bg-slate-800'
          }`}
        >
          <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} className="size-5 accent-sky-500" />
          <span className="flex-1 truncate text-[15px] text-slate-100">{prettyCity(o.label)}</span>
          <span className="text-sm tabular-nums text-slate-400">
            {showDay ? (
              <>
                <strong className="font-semibold text-slate-100">{todayOf(o.value)}</strong> / {o.count}
              </>
            ) : (
              o.count
            )}
          </span>
        </label>
      </li>
    );
  };

  const sectionTitle = 'px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openSheet, summary)
      ) : (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="Filtrar por cidade"
        onClick={openSheet}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-slate-900 px-3.5 text-sm ${
          selected.length > 0 ? 'border-sky-500 text-sky-300' : 'border-slate-700 text-slate-100'
        }`}
      >
        <span className="truncate">📍 {summary}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      )}

      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-[fade-in_.18s_ease-out]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cidades"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-[28px] border-t border-slate-700 bg-slate-900 animate-[sheet-up_.24s_cubic-bezier(.2,.8,.2,1)]"
          >
            <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-slate-700" aria-hidden="true" />

            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3 px-5 pt-3">
              <div className="flex flex-col">
                <h2 className="m-0 text-xl font-bold tracking-tight text-white">Cidades</h2>
                <span className="text-sm text-slate-400">
                  {draft.length === 0 ? (pickMode ? 'Nenhuma escolhida' : 'Todas as cidades') : `${draft.length} selecionada${draft.length !== 1 ? 's' : ''}`}
                  {pickMode ? '' : hasDay && dayLabel ? ` · ${resultCount} médicos na ${dayLabel}` : ` · ${resultCount} médicos`}
                </span>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-transparent text-slate-200 hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Selecionadas: quebram em linhas (sem passar da tela); se forem muitas, rolam só essa área */}
            {draft.length > 0 && (
              <div className="flex max-h-[7.5rem] shrink-0 flex-wrap gap-1.5 overflow-y-auto px-5 pt-3">
                {draft.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    aria-label={`Remover ${labelFor(key)}`}
                    className="flex h-8 max-w-full shrink-0 items-center gap-1.5 rounded-full border border-sky-500/50 bg-sky-500/15 px-3 text-xs font-semibold text-sky-300"
                  >
                    <span className="truncate">{labelFor(key)}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Busca + atalhos */}
            <div className="flex shrink-0 flex-col gap-2 px-5 pt-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cidade..."
                aria-label="Buscar cidade"
                className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-base text-slate-100 outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600 sm:text-sm"
              />
              <div className="flex gap-2">
                {hasDay && (
                  <button
                    type="button"
                    onClick={markDayCities}
                    className="h-9 rounded-full border border-slate-700 bg-transparent px-3.5 text-xs font-semibold text-slate-200 hover:text-white"
                  >
                    Marcar todas com médicos{dayLabel ? ` na ${dayLabel}` : ''}
                  </button>
                )}
                {draft.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraft([])}
                    className="h-9 rounded-full border border-slate-700 bg-transparent px-3.5 text-xs font-semibold text-slate-400 hover:text-red-400"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Lista */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhuma cidade encontrada</p>}
              {withDoctors.length > 0 && (
                <>
                  {hasDay && (
                    <div className={sectionTitle}>
                      Com médicos{dayLabel ? ` na ${dayLabel}` : ''} <span className="normal-case tracking-normal">(hoje / total)</span>
                    </div>
                  )}
                  <ul className="m-0 list-none p-0">{withDoctors.map((o) => row(o, hasDay))}</ul>
                </>
              )}
              {withoutDoctors.length > 0 && (
                <>
                  <div className={sectionTitle}>Sem médicos{dayLabel ? ` na ${dayLabel}` : ''}</div>
                  <ul className="m-0 list-none p-0">{withoutDoctors.map((o) => row(o, false))}</ul>
                </>
              )}
            </div>

            {/* Cancelar + Aplicar */}
            <div
              className="grid shrink-0 grid-cols-[1fr_2fr] gap-2 border-t border-slate-800 px-5 pt-3"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-12 rounded-2xl border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={apply}
                className="h-12 rounded-2xl border-0 bg-slate-100 text-base font-bold text-slate-950"
              >
                {pickMode ? 'Aplicar' : `Aplicar · ${resultCount} médicos`}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
