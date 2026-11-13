'use client';

import { lockScroll } from '@/lib/scrollLock';
import { useEffect, useRef, useState } from 'react';
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
  /** esconde a folha sem desmontar (outra tela por cima; ao voltar, tudo continua igual) */
  hidden?: boolean;
  /** sem o X visível: fecha arrastando para baixo, tocando fora ou no Esc (o X fica só para leitor de tela) */
  hideClose?: boolean;
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
  hidden = false,
  hideClose = false,
  onClose,
  children,
}: BottomSheetProps) {
  /* Arrastar a alça (topo da folha) para baixo fecha; solto antes do ponto, ela volta */
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; id: number } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    drag.current = { y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current = null;
    setDragging(false);
    if (dy > 90) onClose();
    else setDragY(0);
  };

  // Esc fecha; a página por trás não rola
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !hidden) onClose();
    };
    document.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [onClose, hidden]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 animate-[fade-in_.18s_ease-out]"
      onClick={dismissOnBackdrop ? onClose : undefined}
      style={hidden ? { visibility: 'hidden' } : undefined}
      aria-hidden={hidden || undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? label ?? (progress ? `Passo ${progress.step} de ${progress.total}` : 'Painel')}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border-t border-slate-700 bg-slate-900 animate-[sheet-up_.24s_cubic-bezier(.2,.8,.2,1)]"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? 'none' : 'transform 180ms ease' }}
      >
        <div
          className="cursor-grab px-5 pt-2.5 pb-1 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-slate-600" aria-hidden="true" />
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
              className={
                hideClose
                  ? 'sr-only focus:not-sr-only focus:flex focus:size-10 focus:items-center focus:justify-center focus:rounded-xl focus:border focus:border-slate-700'
                  : 'flex size-10 items-center justify-center rounded-xl border border-slate-700 bg-transparent text-slate-200 hover:text-white'
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sem rodapé, o conteúdo reserva a área do gesto do iPhone/Android para a última linha não ficar escondida */}
        <div
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-4"
          style={{ paddingBottom: footer ? 16 : 'calc(max(env(safe-area-inset-bottom), 8px) + 16px)' }}
        >
          {children}
        </div>

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
