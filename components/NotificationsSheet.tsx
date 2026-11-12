'use client';

import BottomSheet from '@/components/BottomSheet';
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
  onOpenDoctor: (doctorId: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

/** Sino: avisos de hoje e de ontem, só das cidades da semana, com bolinha de não lido */
export default function NotificationsSheet({ items, now, allCities, onOpenDoctor, onMarkAllRead, onClose }: NotificationsSheetProps) {
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
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-3xl" aria-hidden="true">🔔</span>
          <p className="m-0 text-base font-semibold text-slate-100">Nenhum aviso por enquanto</p>
          <p className="m-0 max-w-xs text-sm leading-snug text-slate-400">
            Quando um colega marcar &quot;Último paciente&quot; ou &quot;Rep. no consultório&quot; em uma cidade da sua semana, aparece aqui.
          </p>
        </div>
      ) : (
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
