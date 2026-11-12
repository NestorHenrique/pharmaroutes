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
  'w-full min-w-0 box-border h-[52px] px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';

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

  const [shown, setShown] = useState<Record<string, boolean>>({});
  const field = (label: string, value: string, set: (v: string) => void, ac: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <span className="flex h-[52px] items-center rounded-xl border border-slate-700 bg-slate-950 pl-3.5 pr-1.5 focus-within:border-blue-600">
        <input
          type={shown[label] ? 'text' : 'password'}
          autoComplete={ac}
          value={value}
          onChange={(e) => {
            set(e.target.value);
            setDone(false);
          }}
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-slate-100 outline-hidden placeholder:text-slate-500"
        />
        <button
          type="button"
          aria-label={shown[label] ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={!!shown[label]}
          onClick={() => setShown((v) => ({ ...v, [label]: !v[label] }))}
          className="grid size-11 place-items-center border-0 bg-transparent text-slate-500"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {shown[label] && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </span>
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
      {field('Senha nova', next, setNext, 'new-password')}
      {field('Repita a senha nova', repeat, setRepeat, 'new-password')}

      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Regras da senha">
        {rules.map((r) => (
          <li key={r.id} className={`flex items-center gap-2 text-[13px] ${r.ok ? 'text-emerald-300' : 'text-slate-500'}`}>
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
        className="h-[52px] rounded-[14px] border-0 bg-blue-600 text-base font-bold text-white hover:bg-blue-500 disabled:opacity-40"
      >
        {busy ? 'Salvando…' : submitLabel}
      </button>
    </form>
  );
}
