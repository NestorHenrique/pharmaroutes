'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  /** cidade do médico */
  city?: string;
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

const TONE: Record<NoticeType, { label: string; card: string; circle: string; labelCls: string; dim: string; icon: ReactNode }> = {
  ultimo_paciente: {
    label: 'Último paciente',
    card: 'border-red-500 bg-red-500/10',
    circle: 'bg-red-500 text-slate-950',
    labelCls: 'text-red-300',
    dim: 'text-red-300',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 6v7M12 17.5v.5" />
      </svg>
    ),
  },
  representante_no_consultorio: {
    label: 'Rep. no consultório',
    card: 'border-sky-500 bg-sky-500/10',
    circle: 'bg-sky-500 text-slate-950',
    labelCls: 'text-sky-300',
    dim: 'text-sky-300',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
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

function ago(iso: string, now: number): string {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  return hhmm(iso);
}

interface NotificationsSheetProps {
  items: NoticeItem[];
  now: number;
  /** o aparelho não escolheu cidades para a semana: a lista mostra todas */
  allCities: boolean;
  /** nomes das cidades da semana, para "Só das suas cidades: ..." */
  cityNames?: string[];
  /** alterações de dados esperando aprovação (as dos colegas para eu decidir; as minhas para acompanhar) */
  approvals: ApprovalItem[];
  /** devolve a frase do resultado */
  onDecide: (id: string, approve: boolean) => Promise<string>;
  onOpenDoctor: (doctorId: string) => void;
  onMarkAllRead: () => void;
  /** engrenagem do cabeçalho: abre o perfil (ajustes de avisos) */
  onSettings?: () => void;
  onClose: () => void;
}

/** Notificações: página com Hoje/Ontem, cartões coloridos e bolinha de não lido */
export default function NotificationsSheet({ items, now, allCities, cityNames, approvals, onDecide, onOpenDoctor, onMarkAllRead, onSettings, onClose }: NotificationsSheetProps) {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const heading = 'm-0 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 animate-[fade-in_.18s_ease-out]">
      <div role="dialog" aria-modal="true" aria-label="Notificações" className="mx-auto flex h-full w-full max-w-xl flex-col">
        <header className="flex items-center gap-2 px-3 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
          <button type="button" aria-label="Voltar" onClick={onClose} className="grid size-11 place-items-center rounded-xl border-0 bg-transparent text-slate-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h1 className="font-display m-0 flex-1 text-[26px] font-extrabold tracking-tight text-slate-50">Avisos</h1>
          {onSettings && (
            <button type="button" aria-label="Configurar notificações" onClick={onSettings} className="grid size-11 place-items-center rounded-xl border border-slate-800 bg-slate-900 text-slate-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
          )}
        </header>

        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="flex-1 text-xs text-slate-400">
            {allCities || !cityNames?.length ? 'De todas as cidades (escolha as suas em Perfil)' : `Só das suas cidades: ${cityNames.join(', ')}`}
          </span>
          <button
            type="button"
            disabled={unread === 0}
            onClick={onMarkAllRead}
            className="min-h-11 shrink-0 border-0 bg-transparent px-1 text-[13px] font-semibold text-blue-400 disabled:opacity-40"
          >
            Marcar tudo como lido
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-8">
          {msg && (
            <div role="status" className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              {msg}
            </div>
          )}

          {approvals.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className={heading}>{toReview.length > 0 ? `Alterações para aprovar · ${toReview.length}` : 'Suas alterações aguardando'}</h2>
              {[...toReview, ...mineWaiting].map((a) => (
                <div key={a.id} className="flex flex-col gap-2 rounded-2xl border border-amber-500 bg-amber-500/10 p-3">
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
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <span className="grid size-14 place-items-center rounded-full border border-slate-800 bg-slate-900 text-slate-400">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10 21a2 2 0 0 0 4 0" />
                </svg>
              </span>
              <p className="m-0 text-base font-semibold text-slate-100">Nenhum aviso por enquanto</p>
              <p className="m-0 max-w-xs text-sm leading-snug text-slate-400">
                Quando um colega marcar &quot;Último paciente&quot; ou &quot;Rep. no consultório&quot; em uma cidade da sua semana, aparece aqui.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.k} className="flex flex-col gap-2">
                <h2 className={`${heading} mt-2`}>{g.k === 'Antes' ? 'Anteriores' : g.k}</h2>
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
                          className={`flex w-full items-start gap-3 rounded-[20px] border border-slate-800 bg-slate-900 p-3.5 text-left ${n.unread ? '' : 'opacity-80'}`}
                        >
                          <span
                            className={`mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-slate-800 ${
                              n.type === 'ultimo_paciente' ? 'bg-red-400' : n.type === 'representante_no_consultorio' ? 'bg-sky-400' : n.type === 'aguardando_medico' ? 'bg-amber-400' : 'bg-slate-500'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className={`text-sm font-bold ${n.unread ? tone.labelCls : 'text-slate-400'}`}>{tone.label}</span>
                            <span className="text-[13px] text-slate-400">
                              <span className="font-semibold uppercase text-slate-100">{n.doctorName}</span>
                              {[n.place, n.city].filter(Boolean).length > 0 && ` · ${[n.place, n.city].filter(Boolean).join(' · ')}`}
                              {n.repName ? `. ${shortName(n.repName).split(' ')[0]} avisou.` : ''}
                            </span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">{ago(n.at, now)}</span>
                          {n.unread && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-blue-600" role="img" aria-label="Não lido" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
