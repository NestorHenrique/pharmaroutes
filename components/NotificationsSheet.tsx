'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { ChangeLine } from '@/lib/editProposals';
import { shortName } from '@/lib/visits';
import type { NoticeType } from '@/hooks/useNotifications';

export interface NoticeItem {
  id: number;
  doctorId: string;
  type: NoticeType;
  at: string;
  doctorName: string;
  place: string;
  repName: string;
  unread: boolean;
}

/** Alteração de nome/CRM/UF/especialidade esperando decisão */
export interface ApprovalItem {
  id: string;
  doctorName: string;
  /** quem propôs (primeiro nome) */
  by: string;
  lines: ChangeLine[];
  /** é minha: só posso cancelar */
  mine: boolean;
  /** horas até valer sozinha */
  hoursLeft: number;
}

const TONE: Record<NoticeType, { label: string; card: string; pill: string }> = {
  ultimo_paciente: { label: 'Último paciente', card: 'border-red-500/50 bg-red-500/10', pill: 'bg-red-500 text-slate-950' },
  representante_no_consultorio: { label: 'Rep. no consultório', card: 'border-sky-500/50 bg-sky-500/10', pill: 'bg-sky-500 text-slate-950' },
};

function dayKey(iso: string, now: number): 'Hoje' | 'Ontem' | 'Antes' {
  const d = new Date(iso);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString() ? 'Ontem' : 'Antes';
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

interface NotificationsSheetProps {
  items: NoticeItem[];
  now: number;
  /** o aparelho não escolheu cidades para a semana: a lista mostra todas */
  allCities: boolean;
  /** alterações de dados esperando aprovação (as dos colegas para eu decidir; as minhas para acompanhar) */
  approvals: ApprovalItem[];
  /** devolve a frase do resultado */
  onDecide: (id: string, approve: boolean) => Promise<string>;
  onOpenDoctor: (doctorId: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

/** Sino: avisos de hoje e de ontem, só das cidades da semana, com bolinha de não lido */
export default function NotificationsSheet({ items, now, allCities, approvals, onDecide, onOpenDoctor, onMarkAllRead, onClose }: NotificationsSheetProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const decide = async (id: string, approve: boolean) => {
    setBusyId(id);
    setMsg(await onDecide(id, approve));
    setBusyId(null);
  };
  const toReview = approvals.filter((a) => !a.mine);
  const mineWaiting = approvals.filter((a) => a.mine);
  const unread = items.filter((i) => i.unread).length;
  const groups = (['Hoje', 'Ontem', 'Antes'] as const)
    .map((k) => ({ k, list: items.filter((i) => dayKey(i.at, now) === k) }))
    .filter((g) => g.list.length > 0);

  return (
    <BottomSheet
      title="Avisos"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={unread === 0}
          onClick={onMarkAllRead}
          className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
        >
          Marcar tudo como lido
        </button>
      }
    >
      {msg && (
        <div role="status" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
          {msg}
        </div>
      )}

      {approvals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {toReview.length > 0 ? `Alterações para aprovar · ${toReview.length}` : 'Suas alterações aguardando'}
          </h3>
          {[...toReview, ...mineWaiting].map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-3">
              <span className="text-[15px] font-semibold uppercase text-slate-50">{a.doctorName}</span>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-slate-200">
                {a.lines.map((l) => (
                  <li key={l.label}>
                    <span className="font-semibold">{l.label}:</span> <span className="text-slate-400 line-through">{l.de}</span> →{' '}
                    <strong>{l.para}</strong>
                  </li>
                ))}
              </ul>
              <span className="text-xs text-slate-400">
                {a.mine ? 'Você propôs' : `${a.by} propôs`} · vale sozinha em {a.hoursLeft} h se ninguém decidir
              </span>
              <div className="flex gap-2">
                {!a.mine && (
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => void decide(a.id, true)}
                    className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    Aprovar
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => void decide(a.id, false)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-slate-600 bg-transparent text-sm font-semibold text-slate-100 hover:border-slate-400 disabled:opacity-40"
                >
                  {a.mine ? 'Cancelar alteração' : 'Recusar'}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {items.length === 0 && approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-3xl" aria-hidden="true">🔔</span>
          <p className="m-0 text-base font-semibold text-slate-100">Nenhum aviso por enquanto</p>
          <p className="m-0 max-w-xs text-sm leading-snug text-slate-400">
            Quando um colega marcar &quot;Último paciente&quot; ou &quot;Rep. no consultório&quot; em uma cidade da sua semana, aparece aqui.
          </p>
        </div>
      ) : items.length === 0 ? null : (
        <>
          {allCities && (
            <p className="m-0 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs leading-snug text-slate-400">
              Você ainda não escolheu as cidades da semana, então aparecem os avisos de todas. Escolha em Perfil → Cidades.
            </p>
          )}
          {groups.map((g) => (
            <section key={g.k} className="flex flex-col gap-2">
              <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{g.k === 'Antes' ? 'Anteriores' : g.k}</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {g.list.map((n) => {
                  const tone = TONE[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenDoctor(n.doctorId);
                          onClose();
                        }}
                        className={`relative flex w-full flex-col gap-1 rounded-2xl border p-3 text-left ${tone.card}`}
                      >
                        {n.unread && (
                          <span className="absolute right-3 top-3 size-2.5 rounded-full bg-blue-400" role="img" aria-label="Não lido" />
                        )}
                        <span className={`self-start rounded-md px-2 py-0.5 text-[11px] font-bold ${tone.pill}`}>{tone.label}</span>
                        <span className="pr-5 text-[15px] font-semibold uppercase text-slate-50">{n.doctorName}</span>
                        <span className="text-xs uppercase text-slate-400">{n.place}</span>
                        <span className="text-xs text-slate-300">
                          {n.repName ? `${shortName(n.repName)} · ` : ''}
                          {hhmm(n.at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </BottomSheet>
  );
}
