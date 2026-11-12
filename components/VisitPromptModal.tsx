'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface VisitPromptModalProps {
  doctorName: string;
  /** "Rep. no consultório" etc. */
  statusLabel: string;
  /** "14:20" */
  startedAt: string;
  /** "14:30" */
  endedAt: string;
  /** "1 de 2 perguntas" (null com uma só) */
  counter: string | null;
  onYes: () => void;
  onNo: () => void;
}

/**
 * Janela que BLOQUEIA o uso até responder: sem botão de fechar, sem fechar pelo fundo e sem Esc.
 * Quem não responde fica com a pergunta pendente para a próxima abertura do app.
 */
export default function VisitPromptModal({ doctorName, statusLabel, startedAt, endedAt, counter, onYes, onNo }: VisitPromptModalProps) {
  const yesRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    yesRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm animate-[fade-in_.18s_ease-out]"
      onKeyDown={(e) => {
        // mantém o foco dentro da janela
        if (e.key === 'Tab') {
          const btns = e.currentTarget.querySelectorAll('button');
          const first = btns[0];
          const last = btns[btns.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="visit-prompt-title"
        aria-describedby="visit-prompt-desc"
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
            <h2 id="visit-prompt-title" className="m-0 text-[15px] font-bold uppercase tracking-[0.1em] text-blue-400">
              Já visitou?
            </h2>
          </div>
          {counter && <span className="text-xs font-semibold text-slate-400">{counter}</span>}
        </div>

        <div id="visit-prompt-desc" className="flex flex-col gap-1.5">
          <p className="m-0 text-lg font-bold uppercase leading-snug text-slate-50">{doctorName}</p>
          <p className="m-0 text-sm leading-snug text-slate-400">
            Você marcou <strong className="text-slate-200">{statusLabel}</strong> às {startedAt} e o tempo acabou às {endedAt}.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            ref={yesRef}
            type="button"
            onClick={onYes}
            className="h-14 rounded-2xl border-0 bg-emerald-600 text-base font-bold text-white hover:bg-emerald-500"
          >
            Sim, já visitei
          </button>
          <button
            type="button"
            onClick={onNo}
            className="h-14 rounded-2xl border border-slate-600 bg-transparent text-base font-semibold text-slate-100 hover:border-slate-400"
          >
            Ainda não
          </button>
        </div>
        <p className="m-0 text-center text-xs leading-snug text-slate-500">
          &quot;Ainda não&quot; tira o status e o médico continua na sua rota.
        </p>
      </div>
    </div>,
    document.body,
  );
}
