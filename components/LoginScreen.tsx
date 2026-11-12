'use client';

import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { friendlyAuthError, rememberKeepLogin, sendResetEmail } from '@/lib/auth';

type Mode = 'login' | 'forgot' | 'sent';

const inputCls =
  'w-full min-w-0 box-border h-12 rounded-xl border border-slate-800 bg-slate-950 px-3.5 text-base text-slate-100 placeholder:text-slate-500 outline-hidden hover:border-slate-700 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const submitCls = `mt-1 h-12 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-500 active:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
    loading ? 'opacity-60 cursor-wait' : ''
  }`;

  const header = (subtitle: string) => (
    <div className="flex flex-col items-center text-center mb-1">
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-blue-600 text-xl font-bold text-white">P</div>
      <h1 className="my-1 text-[26px] font-bold tracking-tight text-slate-100">PharmaRoutes</h1>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  );

  const card = 'w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[28px] p-6 sm:p-8 flex flex-col gap-5 shadow-2xl shadow-black/40';

  const emailField = (
    <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
      <span>E-mail</span>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputCls}
      />
    </label>
  );

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      {mode === 'login' && (
        <form onSubmit={handleLogin} className={card}>
          {header('Acesse com a sua conta')}
          {emailField}
          <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
            <span>Senha</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={keep}
                onChange={(e) => setKeep(e.target.checked)}
                className="size-5 shrink-0 accent-blue-600"
              />
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

          <button type="submit" disabled={loading} className={submitCls}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={handleForgot} className={card}>
          {header('Vamos te enviar um link para criar uma senha nova')}
          {emailField}
          {error && <div role="alert" className="text-xs text-red-300">{error}</div>}
          <button type="submit" disabled={loading} className={submitCls}>
            {loading ? 'Enviando…' : 'Enviar link'}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('login');
            }}
            className="min-h-11 border-0 bg-transparent p-0 text-sm font-semibold text-slate-300 hover:text-white"
          >
            Voltar para o login
          </button>
        </form>
      )}

      {mode === 'sent' && (
        <div className={card}>
          {header('Confira o seu e-mail')}
          <p className="m-0 text-center text-sm leading-snug text-slate-300">
            Se <strong className="text-slate-100">{email.trim()}</strong> tiver cadastro, o link chega em alguns minutos. Olhe também o
            spam. Abra o link neste aparelho para criar a senha nova.
          </p>
          <button type="button" onClick={() => setMode('login')} className={submitCls}>
            Voltar para o login
          </button>
        </div>
      )}
    </div>
  );
}
