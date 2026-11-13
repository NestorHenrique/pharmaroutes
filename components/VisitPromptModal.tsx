'use client';

import { lockScroll } from '@/lib/scrollLock';
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
export default function VisitPromptModal({ doctorName, statusLabel, startedAt, counter, onYes, onNo }: VisitPromptModalProps) {
  const yesRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const unlock = lockScroll();
    yesRef.current?.focus();
    return () => {
      unlock();
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
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-slate-700 bg-slate-900 px-5 pb-5 pt-6 shadow-2xl shadow-black/50"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {counter && <span className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">{counter}</span>}
          <span className="grid size-14 place-items-center rounded-full border border-sky-500 bg-sky-950 text-sky-300" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20a7 7 0 0 1 14 0" />
            </svg>
          </span>
          <h2 id="visit-prompt-title" className="m-0 text-[22px] font-bold uppercase leading-tight tracking-tight text-slate-50">
            Já visitou o {doctorName}?
          </h2>
          <p id="visit-prompt-desc" className="m-0 inline-flex items-center rounded-full bg-sky-950 px-2.5 py-1.5 text-xs font-semibold leading-snug text-sky-300">
            Você marcou {statusLabel} · {startedAt}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            ref={yesRef}
            type="button"
            onClick={onYes}
            className="flex h-14 items-center justify-center gap-2 rounded-[14px] border-0 bg-emerald-500 text-[17px] font-bold text-slate-950 hover:bg-emerald-400"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
            Sim, já visitei
          </button>
          <button
            type="button"
            onClick={onNo}
            className="h-14 rounded-[14px] border border-slate-700 bg-slate-950 text-[17px] font-semibold text-slate-100"
          >
            Ainda não
          </button>
        </div>
        <p className="m-0 text-center text-xs leading-snug text-slate-500">
          Responda para continuar usando o app. &quot;Sim&quot; deixa o card verde com seu nome e a hora. &quot;Ainda não&quot; volta o médico para a rota.
        </p>
      </div>
    </div>,
    document.body,
  );
}
