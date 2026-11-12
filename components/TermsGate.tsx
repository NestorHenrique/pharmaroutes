'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TERMS_SECTIONS, TERMS_VERSION } from '@/lib/terms';

interface TermsGateProps {
  saving?: boolean;
  onAccept: () => void;
  /** quem não aceita pode sair da conta */
  onLogout: () => void;
}

/** Primeiro acesso: termos de uso e privacidade. Bloqueia o app até aceitar (ou sair). */
export default function TermsGate({ saving = false, onAccept, onLogout }: TermsGateProps) {
  const [checked, setChecked] = useState(false);
  const boxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="flex max-h-[94dvh] w-full max-w-xl flex-col rounded-t-[28px] border border-slate-700 bg-slate-900 sm:rounded-[28px]"
      >
        <div className="flex items-center gap-2 px-5 pt-5">
          <span className="h-4 w-1 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
          <h2 id="terms-title" className="m-0 text-[15px] font-bold uppercase tracking-[0.1em] text-blue-400">
            Termos de uso e privacidade
          </h2>
        </div>
        <p className="m-0 px-5 pt-2 text-xs text-slate-500">Versão {TERMS_VERSION}. Leia e aceite para continuar.</p>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {TERMS_SECTIONS.map((s) => (
            <section key={s.title} className="flex flex-col gap-1.5">
              <h3 className="m-0 text-sm font-bold text-slate-100">{s.title}</h3>
              {s.body.map((p) => (
                <p key={p} className="m-0 text-sm leading-snug text-slate-300">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 px-5 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-200">
            <input
              ref={boxRef}
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="size-5 shrink-0 accent-blue-600"
            />
            Li e aceito os termos de uso e o aviso de privacidade
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-5 text-sm font-medium text-slate-300 hover:text-white"
            >
              Sair
            </button>
            <button
              type="button"
              disabled={!checked || saving}
              onClick={onAccept}
              className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {saving ? 'Salvando…' : 'Aceitar e continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
