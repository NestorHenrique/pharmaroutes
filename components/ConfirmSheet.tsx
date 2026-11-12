'use client';

import type { ReactNode } from 'react';
import BottomSheet from '@/components/BottomSheet';

interface ConfirmSheetProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação em folha (no lugar do confirm() do navegador): botões grandes, sem fechar pelo fundo */
export default function ConfirmSheet({ title, children, confirmLabel, cancelLabel = 'Cancelar', busy = false, onConfirm, onCancel }: ConfirmSheetProps) {
  return (
    <BottomSheet
      title={title}
      onClose={onCancel}
      dismissOnBackdrop={false}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-5 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-sm leading-snug text-slate-300">{children}</div>
    </BottomSheet>
  );
}
