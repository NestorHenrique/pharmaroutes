'use client';

import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError('Erro ao aceder: ' + authError.message);
    setLoading(false);
  };

  const inputCls =
    'w-full min-w-0 box-border rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-3 text-base text-slate-100 placeholder:text-slate-500 outline-hidden hover:border-slate-700 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm';

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center text-center mb-1">
          <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-blue-500/30 bg-blue-600/15 text-xl font-semibold text-blue-400">
            P
          </div>
          <h1 className="my-1 text-2xl font-semibold tracking-tight text-slate-100">PharmaRoutes</h1>
          <p className="mt-1 text-sm text-slate-400">Acesse com a sua conta</p>
        </div>

        <div className="flex flex-col gap-2 text-xs font-medium text-slate-300">
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
        </div>

        <div className="flex flex-col gap-2 text-xs font-medium text-slate-300">
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
        </div>

        {error && <div role="alert" className="text-[11px] text-red-300">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className={`mt-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 active:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
            loading ? 'opacity-60 cursor-wait' : ''
          }`}
        >
          {loading ? 'A entrar...' : 'Entrar na Plataforma'}
        </button>
      </form>
    </div>
  );
}
