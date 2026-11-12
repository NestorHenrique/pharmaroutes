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
      className="fixed inset-x-4 z-[65] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 py-2 pl-4 pr-2 shadow-2xl shadow-black/60 animate-[fade-in_.18s_ease-out]"
      style={{ bottom: 'max(env(safe-area-inset-bottom), 16px)' }}
    >
      <span className="min-w-0 flex-1 text-sm leading-snug text-slate-100">{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
          className="h-11 shrink-0 rounded-xl border-0 bg-transparent px-3 text-sm font-bold text-blue-400 hover:text-blue-300"
        >
          Desfazer
        </button>
      )}
    </div>,
    document.body,
  );
}
