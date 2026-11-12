'use client';

import { useState } from 'react';
import PasswordForm from '@/components/PasswordForm';
import { setNewPassword } from '@/lib/auth';

/** Aparece depois de abrir o link do e-mail "Esqueci a senha": define a senha nova e entra */
export default function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 flex flex-col gap-5 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-full border border-blue-800 bg-blue-950 text-xl font-bold text-blue-600">P</div>
          <h1 className="my-1 text-[22px] font-bold tracking-tight text-slate-100">Criar senha nova</h1>
          <p className="mt-1 text-sm text-slate-400">Escolha uma senha que você não use em outros lugares.</p>
        </div>
        {done ? (
          <button
            type="button"
            onClick={onDone}
            className="h-[52px] rounded-[14px] border-0 bg-blue-600 text-base font-bold text-white hover:bg-blue-500"
          >
            Entrar no app
          </button>
        ) : (
          <PasswordForm requireCurrent={false} submitLabel="Salvar senha nova" onSubmit={(_c, n) => setNewPassword(n)} onDone={() => setDone(true)} />
        )}
      </div>
    </div>
  );
}
