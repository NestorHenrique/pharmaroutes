'use client';

import { useState } from 'react';
import { passwordRules, passwordValid } from '@/lib/password';

interface PasswordFormProps {
  /** pede a senha atual (trocar senha logado); fora disso é a nova senha depois do link do e-mail */
  requireCurrent: boolean;
  submitLabel: string;
  /** devolve a mensagem de erro, ou null se deu certo */
  onSubmit: (current: string, next: string) => Promise<string | null>;
  onDone?: () => void;
}

const inputCls =
  'w-full min-w-0 box-border h-12 px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';

/** Senha atual (opcional), nova e repetir, com as regras ficando verdes */
export default function PasswordForm({ requireCurrent, submitLabel, onSubmit, onDone }: PasswordFormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rules = passwordRules(next, repeat);
  const valid = passwordValid(next, repeat) && (!requireCurrent || current.length > 0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const err = await onSubmit(current, next);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
    setCurrent('');
    setNext('');
    setRepeat('');
    onDone?.();
  };

  const field = (label: string, value: string, set: (v: string) => void, ac: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input
        type="password"
        autoComplete={ac}
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setDone(false);
        }}
        className={inputCls}
      />
    </label>
  );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) void submit();
      }}
    >
      {requireCurrent && field('Senha atual', current, setCurrent, 'current-password')}
      {field('Nova senha', next, setNext, 'new-password')}
      {field('Repetir a nova senha', repeat, setRepeat, 'new-password')}

      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Regras da senha">
        {rules.map((r) => (
          <li key={r.id} className={`flex items-center gap-2 text-xs ${r.ok ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded-full border ${r.ok ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600'}`}>
              {r.ok && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </span>
            {r.label}
          </li>
        ))}
      </ul>

      {error && <div role="alert" className="text-xs leading-snug text-red-400">{error}</div>}
      {done && <div role="status" className="text-xs leading-snug text-emerald-400">Senha trocada.</div>}

      <button
        type="submit"
        disabled={!valid || busy}
        className="h-12 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
      >
        {busy ? 'Salvando…' : submitLabel}
      </button>
    </form>
  );
}
