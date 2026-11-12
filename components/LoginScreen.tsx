'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { friendlyAuthError, rememberKeepLogin, sendResetEmail } from '@/lib/auth';

type Mode = 'login' | 'forgot' | 'sent';

const inputCls =
  'h-[52px] w-full min-w-0 box-border rounded-xl border border-slate-800 bg-slate-900 px-3.5 text-base text-slate-100 placeholder:text-slate-500 outline-hidden focus-visible:border-blue-600';

/** Logo, nome e frase do app (igual ao desenho do login) */
function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-3.5 text-center">
      <div className="grid size-[72px] place-items-center rounded-[22px] border border-blue-800 bg-blue-950 text-blue-600">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Logo Rota Propagandista">
          <path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z" />
          <circle cx="12" cy="11" r="2.4" />
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[26px] font-bold tracking-tight text-slate-50">Rota Propagandista</h1>
        <span className="text-sm text-slate-400">{subtitle}</span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-7 px-6 py-8">{children}</div>;
}

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [keep, setKeep] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(friendlyAuthError(authError.message));
    else rememberKeepLogin(keep);
    setLoading(false);
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const err = await sendResetEmail(email);
    setLoading(false);
    if (err) setError(err);
    else setMode('sent');
  };

  const primary = `h-[52px] w-full rounded-[14px] border-0 bg-blue-600 px-4 text-base font-bold text-white hover:bg-blue-500 ${loading ? 'cursor-wait opacity-60' : ''}`;

  const emailField = (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-300">
      E-mail
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="voce@empresa.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputCls}
      />
    </label>
  );

  if (mode === 'login') {
    return (
      <Shell>
        <Brand subtitle="Gestão inteligente e alta performance em campo." />
        <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
          {emailField}
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-300">
            Senha
            <span className="flex h-[52px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 pl-3.5 pr-1.5 focus-within:border-blue-600">
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-base text-slate-100 outline-hidden placeholder:text-slate-500"
              />
              <button
                type="button"
                aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPw}
                onClick={() => setShowPw((v) => !v)}
                className="grid size-11 place-items-center border-0 bg-transparent text-slate-500 hover:text-slate-200"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPw && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </span>
          </label>

          <div className="flex items-center justify-between gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-300">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="peer sr-only" />
              <span className="grid size-[22px] place-items-center rounded-md border border-slate-700 text-transparent peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-slate-950 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              Manter conectado
            </label>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('forgot');
              }}
              className="min-h-11 border-0 bg-transparent p-0 text-sm font-semibold text-blue-400 hover:underline"
            >
              Esqueci a senha
            </button>
          </div>

          {error && <div role="alert" className="text-xs text-red-300">{error}</div>}

          <button type="submit" disabled={loading} className={primary}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <span className="text-center text-xs leading-relaxed text-slate-500">Sem acesso? Fale com o administrador da sua equipe.</span>
      </Shell>
    );
  }

  /* Esqueci a senha / link enviado: tela cheia com seta de voltar, igual ao protótipo */
  const backToLogin = () => {
    setError(null);
    setMode('login');
  };
  const sent = mode === 'sent';
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col">
      <header className="px-3 pb-2 pt-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={backToLogin}
          className="grid size-11 place-items-center rounded-xl border-0 bg-transparent text-slate-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </header>
      <form onSubmit={handleForgot} className="flex flex-1 flex-col gap-6 px-6 pb-7 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-50">{sent ? 'Confira o seu e-mail' : 'Esqueceu a senha?'}</h1>
          <span className="text-sm leading-relaxed text-slate-400">
            {sent
              ? 'Abra o link neste aparelho para criar a senha nova.'
              : 'Digite o e-mail de acesso. Enviamos um link para você criar uma senha nova.'}
          </span>
        </div>

        {sent ? (
          <div className="flex items-center gap-1.5 text-sm text-slate-300">
            <strong className="text-slate-100">{email.trim()}</strong>
          </div>
        ) : (
          emailField
        )}

        {sent && (
          <div className="flex items-start gap-2.5 rounded-[14px] border border-emerald-800 bg-emerald-950 px-3.5 py-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-slate-950">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <span className="flex-1 text-[13px] leading-snug text-slate-300">
              <b className="text-emerald-300">Link enviado.</b> Abra o e-mail no celular e toque no link. Não chegou? Veja o spam ou peça de novo em 1 minuto.
            </span>
          </div>
        )}

        {error && <div role="alert" className="text-xs text-red-300">{error}</div>}

        <span className="flex-1" />

        <div className="flex flex-col gap-2.5">
          {!sent && (
            <button type="submit" disabled={loading} className={primary}>
              {loading ? 'Enviando…' : 'Enviar link'}
            </button>
          )}
          <button
            type="button"
            onClick={backToLogin}
            className={
              sent
                ? primary
                : 'h-[52px] w-full rounded-[14px] border border-slate-700 bg-slate-950 px-4 text-base font-semibold text-slate-100'
            }
          >
            Voltar ao login
          </button>
        </div>
      </form>
    </div>
  );
}
