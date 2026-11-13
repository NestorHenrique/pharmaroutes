# Shared UI components (PharmaRoutes)

Framework: Next.js 16 (App Router, one client page) + React 19. CSS: Tailwind v4 (no tailwind.config), custom components, no UI library. Theme remaps slate/blue scales via CSS vars (see theme.md).

### `components/BottomSheet.tsx`

```tsx
'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  /** título em destaque (mesmo modelo dos títulos do cadastro); sem título só aparece a alça */
  title?: string;
  /** nome da folha para leitores de tela quando não há título visível */
  label?: string;
  /** fluxo em passos (primeiro acesso): mostra as barrinhas "Passo X de Y" no lugar do título */
  progress?: { step: number; total: number };
  /** botões fixos embaixo (ex.: Limpar / Ver resultados) */
  footer?: ReactNode;
  /** tocar no fundo escuro fecha (desligue em formulários para não perder o que foi digitado) */
  dismissOnBackdrop?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Folha que sobe de baixo, igual à ficha do médico. Renderizada no <body>, então nunca fica
 * presa dentro do cabeçalho ou da lista. Filtros, Novo médico e Confirmar rota usam o mesmo padrão.
 */
export default function BottomSheet({
  title,
  label,
  progress,
  footer,
  dismissOnBackdrop = true,
  onClose,
  children,
}: BottomSheetProps) {
  // Esc fecha; a página por trás não rola
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 animate-[fade-in_.18s_ease-out]"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? label ?? (progress ? `Passo ${progress.step} de ${progress.total}` : 'Painel')}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border-t border-slate-700 bg-slate-900 animate-[sheet-up_.24s_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="px-5 pt-2.5">
          <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-slate-700" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            {progress ? (
              <div className="flex items-center gap-1.5" role="img" aria-label={`Passo ${progress.step} de ${progress.total}`}>
                {Array.from({ length: progress.total }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-7 rounded-full ${i < progress.step ? 'bg-blue-600' : 'bg-slate-700'}`}
                    aria-hidden="true"
                  />
                ))}
                <span className="ml-1.5 text-xs text-slate-500">
                  Passo {progress.step} de {progress.total}
                </span>
              </div>
            ) : title ? (
              <h2 className="m-0 text-xl font-bold tracking-tight text-slate-50">{title}</h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-xl border border-slate-700 bg-transparent text-slate-200 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div
            className="flex gap-2 border-t border-slate-800 px-5 pt-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

```

### `components/PickerSheet.tsx`

```tsx
'use client';

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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
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

```

### `components/ConfirmSheet.tsx`

```tsx
'use client';

import type { ReactNode } from 'react';
import BottomSheet from '@/components/BottomSheet';

interface ConfirmSheetProps {
  /** pergunta em destaque (centralizada, com ícone em cima) */
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  /** "danger": ícone de lixeira e botão vermelho (excluir) */
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação em folha (no lugar do confirm() do navegador): ícone, pergunta, botões grandes empilhados, sem fechar pelo fundo */
export default function ConfirmSheet({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  busy = false,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const danger = tone === 'danger';
  return (
    <BottomSheet
      label={title}
      onClose={onCancel}
      dismissOnBackdrop={false}
      footer={
        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-[52px] rounded-[14px] border-0 text-base font-bold disabled:opacity-40 ${
              danger ? 'bg-red-500 text-slate-950 hover:bg-red-400' : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-[52px] rounded-[14px] border border-slate-700 bg-slate-950 text-base font-semibold text-slate-100 disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className={`grid size-14 place-items-center rounded-full border ${
            danger ? 'border-red-900 bg-red-950 text-red-300' : 'border-blue-800 bg-blue-950 text-blue-300'
          }`}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {danger ? <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /> : <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />}
          </svg>
        </span>
        <h3 className="m-0 text-xl font-bold leading-tight text-slate-50">{title}</h3>
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-400">{children}</div>
      </div>
    </BottomSheet>
  );
}

```

### `components/Toast.tsx`

```tsx
'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ToastData {
  id: number;
  text: string;
  /** botão "Desfazer" (some junto com o aviso) */
  undo?: () => void;
}

/** Aviso curto embaixo da tela, com "Desfazer". Some sozinho depois de 7 segundos. */
export default function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 z-[65] mx-auto flex max-w-md items-center gap-3 min-h-[52px] rounded-[14px] border border-slate-700 bg-slate-800 py-1 pl-4 pr-1.5 shadow-2xl shadow-black/60 animate-[fade-in_.18s_ease-out]"
      style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 16px) + 84px)' }}
    >
      <span className="min-w-0 flex-1 text-sm leading-snug text-slate-50">{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
          className="h-11 shrink-0 rounded-xl border-0 bg-transparent px-3 text-sm font-bold text-blue-300"
        >
          Desfazer
        </button>
      )}
    </div>,
    document.body,
  );
}

```

### `components/EmptyState.tsx`

```tsx
const ICONS = {
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  medico: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0M19 4v4M17 6h4',
  agenda: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
} as const;

interface EmptyStateProps {
  icon: keyof typeof ICONS;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}

/** Tela vazia com explicação e um botão para sair dela */
export default function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="my-6 flex flex-col items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-7 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-blue-800 bg-blue-950 text-blue-600" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[icon]} />
        </svg>
      </span>
      <p className="m-0 text-base font-semibold text-slate-50">{title}</p>
      <p className="m-0 max-w-xs text-[13px] leading-snug text-slate-400">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1.5 h-[52px] rounded-[14px] border border-blue-800 bg-blue-950 px-5 text-base font-semibold text-blue-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

```

### `components/ProgressRing.tsx`

```tsx
/** Anel de progresso: visitados sobre o total. O número fica no meio. */
export default function ProgressRing({ value, total, size = 56, label }: { value: number; total: number; size?: number; label?: string }) {
  const stroke = size >= 80 ? 7 : 5;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <span
      role="img"
      aria-label={label ?? `${value} de ${total} visitados`}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className={`relative font-bold tabular-nums text-slate-100 ${size >= 80 ? 'text-lg' : 'text-[13px]'}`}>
        {value}/{total}
      </span>
    </span>
  );
}

```

### `components/ConnectionBanner.tsx`

```tsx
interface ConnectionBannerProps {
  online: boolean;
  /** alterações esperando para subir */
  pending: number;
  syncing: boolean;
  /** acabou de subir tudo (some sozinho depois de alguns segundos) */
  justSynced: boolean;
}

/**
 * Faixa de conexão no cabeçalho: sem internet (amarela), enviando (azul) e tudo enviado (verde).
 * Quando está tudo certo e nada pendente, não aparece.
 */
export default function ConnectionBanner({ online, pending, syncing, justSynced }: ConnectionBannerProps) {
  const n = `${pending} ${pending === 1 ? 'alteração' : 'alterações'}`;
  let tone = '';
  let text = '';
  if (!online) {
    tone = 'border-amber-500 bg-amber-950 text-amber-300';
    text = pending > 0 ? `Sem internet. ${n} ficam guardadas e vão sozinhas quando voltar.` : 'Sem internet. Suas marcações ficam guardadas e vão sozinhas quando voltar.';
  } else if (pending > 0) {
    tone = 'border-sky-500 bg-sky-950 text-sky-300';
    text = syncing ? `Enviando ${n}…` : `${n} esperando para enviar.`;
  } else if (justSynced) {
    tone = 'border-emerald-800 bg-emerald-950 text-emerald-300';
    text = 'Tudo enviado. Seus colegas já veem.';
  } else {
    return null;
  }
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5 text-[13px] font-semibold leading-snug ${tone}`}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {text}
    </div>
  );
}

```

### `components/RepAvatar.tsx`

```tsx
import { initialsOf, type Visitor } from '@/lib/visits';

interface RepAvatarProps {
  name: string;
  src?: string | null;
  /** diâmetro em px */
  size?: number;
  /** anel dourado: é o próprio usuário */
  me?: boolean;
  className?: string;
}

/** Bolinha com a foto da pessoa; sem foto, as iniciais */
export function RepAvatar({ name, src, size = 26, me = false, className = '' }: RepAvatarProps) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 font-semibold text-slate-100 ${
        me ? 'ring-[1.5px] ring-blue-600' : ''
      } ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" draggable={false} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}

interface VisitorStackProps {
  visitors: readonly Visitor[];
  /** quantas bolinhas mostrar antes do "+N" */
  max?: number;
  size?: number;
}

/** Bolinhas sobrepostas de quem visitou; o excedente vira "+N" */
export function VisitorStack({ visitors, max = 3, size = 26 }: VisitorStackProps) {
  if (visitors.length === 0) return null;
  const shown = visitors.slice(0, max);
  const extra = visitors.length - shown.length;
  return (
    <span className="inline-flex items-center pl-2" aria-label={`${visitors.length} representante(s) visitaram`}>
      {shown.map((v) => (
        <RepAvatar
          key={v.userId}
          name={v.name}
          src={v.avatarUrl}
          me={v.isMe}
          size={size}
          className="-ml-2 border-2 border-slate-900"
        />
      ))}
      {extra > 0 && (
        <span
          style={{ width: size, height: size, fontSize: 10 }}
          className="-ml-2 inline-flex items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 font-semibold text-slate-300"
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

```

### `components/ComboBox.tsx`

```tsx
'use client';

import { useState } from 'react';
import { normalizeText } from '@/utils';
import PickerSheet from '@/components/PickerSheet';

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
  /** título da folha de seleção (padrão: o placeholder) */
  title?: string;
}

/**
 * Campo de seleção: toque abre uma folha por baixo com busca sem acento
 * ("parnaiba" acha "Parnaíba"), lista grande, Limpar e Cancelar.
 */
export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  allowCustom = true,
  size = 'md',
  title,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);

  const key = normalizeText(value);
  const match = key ? options.find((o) => normalizeText(o.value) === key || normalizeText(o.label) === key) : undefined;
  const shown = match?.label ?? value;
  const pad = size === 'sm' ? 'h-10 px-3' : 'h-[52px] px-3.5';

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={ariaLabel ?? placeholder}
        onClick={() => setOpen(true)}
        className={`flex w-full min-w-0 box-border items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 text-left text-base sm:text-sm hover:border-slate-500 ${pad}`}
      >
        <span className={`truncate ${shown ? 'text-slate-100' : 'text-slate-500'}`}>{shown || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <PickerSheet
          title={title ?? placeholder ?? 'Selecionar'}
          options={options}
          value={value}
          allowCustom={allowCustom}
          searchPlaceholder={`Buscar ${(placeholder ?? 'opção').toLowerCase()}...`}
          onSelect={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

```

### `components/Icons.tsx`

```tsx
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Base dos ícones de linha minimalistas (viewBox 24, strokeWidth 1.8).
 * width/height=16 garante tamanho seguro mesmo se o Tailwind não carregar.
 * Decorativos por padrão (aria-hidden); o nome acessível fica no botão/link.
 */
function BaseIcon({ className, children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width={16}
      height={16}
      className={`shrink-0 ${className ?? 'size-4'}`}
      {...props}
    >
      {children}
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </BaseIcon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </BaseIcon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </BaseIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </BaseIcon>
  );
}

export function NavigationIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </BaseIcon>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M16 9h2a2 2 0 0 1 2 2v10" />
      <path d="M2 21h20" />
      <path d="M8 7h4" />
      <path d="M8 11h4" />
      <path d="M8 15h4" />
    </BaseIcon>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
    </BaseIcon>
  );
}

export function LocateIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </BaseIcon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </BaseIcon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </BaseIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </BaseIcon>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </BaseIcon>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </BaseIcon>
  );
}

```

### `components/LocationPills.tsx`

```tsx
'use client';

import type { DoctorLocation } from '@/types/doctor';
import { locationAddress, locationWhen } from '@/lib/locations';

interface LocationPillsProps {
  locais: readonly DoctorLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNavigate: (loc: DoctorLocation) => void;
  /** card esmaecido (indisponível) */
  muted?: boolean;
}

/**
 * Médico com 2 ou mais locais: uma pílula por local. A selecionada é o "Local de hoje" (violeta, borda 2px);
 * a outra mostra quando o médico atende lá. Embaixo: endereço do local escolhido, ajuda e GPS.
 */
export default function LocationPills({ locais, selectedId, onSelect, onNavigate, muted = false }: LocationPillsProps) {
  const sel = locais.find((l) => l.id === selectedId) ?? locais[0];
  const canNavigate = Boolean(sel.map_link.trim() || sel.endereco);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Locais de atendimento">
        {locais.map((l) => {
          const on = l.id === sel.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(l.id)}
              className={`flex min-h-14 min-w-0 flex-col items-start justify-center gap-0.5 rounded-[14px] px-3 py-2 text-left ${
                on ? 'border-2 border-blue-600 bg-blue-900 text-blue-200' : 'border border-slate-700 bg-slate-950 text-slate-300'
              }`}
            >
              <span className="w-full truncate text-[13px] font-bold leading-tight">{l.nome}</span>
              <span className={`w-full truncate text-[11px] ${on ? 'font-semibold text-blue-200' : 'text-slate-400'}`}>
                {on ? 'Local de hoje' : locationWhen(l)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-slate-300">
        <div className="font-medium text-slate-200">{locationAddress(sel)}</div>
        {sel.cidade && <div className="font-semibold text-blue-400">{sel.cidade.toUpperCase()}</div>}
      </div>

      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs text-slate-400">
          Atende em {locais.length} locais. Toque no outro para trocar hoje.
        </span>
        <button
          type="button"
          onClick={() => onNavigate(sel)}
          disabled={!canNavigate || muted}
          className="h-11 shrink-0 rounded-xl border border-blue-800 bg-blue-950 px-4 text-sm font-bold text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sel.map_link ? 'GPS fixo' : 'GPS'}
        </button>
      </div>
    </div>
  );
}

```

### `components/StatusSelector.tsx`

```tsx
'use client';

import { useState } from 'react';
import StatusSheet from '@/components/StatusSheet';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';

/* ── Botão da bandeira do card: abre a folha "Marcar status" (sobe de baixo) ── */

interface StatusSelectorProps {
  doctorId: string;
  doctorName: string;
  /** "ORT · Centro" */
  doctorSubtitle?: string;
  statuses: DoctorStatus[];
  onSet: (
    doctorId: string,
    type: DoctorStatusType,
    opts?: { repName?: string; returnDate?: string },
  ) => void;
  onClear: (doctorId: string, type: DoctorStatusType) => void;
  /** médico já visitado (ciclo ou dia) */
  visited: boolean;
  /** liga/desliga a visita; sem ela a opção "Já visitei" não aparece */
  onToggleVisited?: (visited: boolean) => void;
  /** médico com mais de um local: nome curto do local escolhido ("Cajubá") */
  locationName?: string;
}

export default function StatusSelector({
  doctorId,
  doctorName,
  doctorSubtitle,
  statuses,
  onSet,
  onClear,
  visited,
  onToggleVisited,
  locationName,
}: StatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const hasActiveStatus = statuses.length > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Marcar status"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`size-11 shrink-0 rounded-xl border border-blue-800 bg-blue-950 text-blue-600 flex items-center justify-center ${
          hasActiveStatus ? 'ring-1 ring-blue-600' : ''
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 21V4M5 4h11l-2.5 4L16 12H5" />
        </svg>
      </button>

      {open && (
        <StatusSheet
          doctorId={doctorId}
          doctorName={doctorName}
          doctorSubtitle={doctorSubtitle}
          statuses={statuses}
          visited={visited}
          onSet={onSet}
          onClear={onClear}
          onToggleVisited={onToggleVisited}
          locationName={locationName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

```
