'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import { RepAvatar } from '@/components/RepAvatar';
import { shortName } from '@/lib/visits';

/** Nome sugerido a partir do cadastro: nome já salvo, nome do login ou o começo do e-mail */
export function suggestName(displayName: string | null | undefined, metaName: string | null | undefined, email: string | null | undefined): string {
  const pick = displayName?.trim() || metaName?.trim();
  if (pick) return pick;
  const local = (email ?? '').split('@')[0] ?? '';
  return local
    .split(/[._\-+\d]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

interface NameConfirmSheetProps {
  /** nome sugerido ("Nestor Henrique") */
  suggested: string;
  avatarUrl?: string | null;
  saving?: boolean;
  /** recebe o nome completo já ajustado ("Nestor Henrique") */
  onConfirm: (fullName: string) => void;
  /** fecha sem confirmar: a pergunta volta na próxima abertura do app */
  onLater: () => void;
}

const inputCls =
  'w-full min-w-0 box-border h-12 px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';

/** Primeiro acesso: "Confirme como os colegas te chamam" (nome + sobrenome opcional, com prévia) */
export default function NameConfirmSheet({ suggested, avatarUrl, saving = false, onConfirm, onLater }: NameConfirmSheetProps) {
  const parts = suggested.trim().split(/\s+/).filter(Boolean);
  const [first, setFirst] = useState(parts[0] ?? '');
  const [last, setLast] = useState(parts.slice(1).join(' '));

  const full = titleCase(`${first} ${last}`);
  const valid = titleCase(first).length >= 2;

  return (
    <BottomSheet
      title="Como te chamam?"
      onClose={onLater}
      dismissOnBackdrop={false}
      footer={
        <button
          type="button"
          disabled={!valid || saving}
          onClick={() => onConfirm(full)}
          className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {saving ? 'Salvando…' : 'Confirmar'}
        </button>
      }
    >
      <p className="m-0 text-sm leading-snug text-slate-300">
        Confirme como os colegas te chamam. Esse nome aparece nas etiquetas de quem está no consultório e de quem visitou.
      </p>

      <div className="grid grid-cols-1 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Nome</span>
          <input
            type="text"
            autoComplete="given-name"
            autoCapitalize="words"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="Nestor"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Sobrenome <span className="normal-case tracking-normal text-slate-500">(opcional)</span>
          </span>
          <input
            type="text"
            autoComplete="family-name"
            autoCapitalize="words"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder="Henrique"
            className={inputCls}
          />
        </label>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3" aria-live="polite">
        <RepAvatar name={full || '?'} src={avatarUrl} size={40} me />
        <span className="flex min-w-0 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Os colegas vão ver</span>
          <span className="truncate text-lg font-bold text-slate-50">{shortName(full) || '—'}</span>
        </span>
      </div>
    </BottomSheet>
  );
}
