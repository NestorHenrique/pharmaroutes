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
              <h2 className="font-display m-0 text-xl font-extrabold tracking-tight text-slate-50">{title}</h2>
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
