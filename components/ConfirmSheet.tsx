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
