'use client';

import { useEffect, useState } from 'react';
import type { DoctorStatus } from '@/types/status';
import { STATUS_META } from '@/types/status';
import { shortName, type PublicProfile } from '@/lib/visits';
import { dayTime, eventRepName, fetchDoctorStatusEvents, type StatusEventRow } from '@/lib/statusHistory';

interface StatusHistoryProps {
  doctorId: string;
  /** status ativos agora: quando mudam, o histórico recarrega */
  statuses: readonly DoctorStatus[];
  profiles: Readonly<Record<string, PublicProfile>>;
  /** quantas linhas mostrar antes de "Ver mais" */
  initial?: number;
  /** o médico tem mais de um local: mostra onde cada status foi marcado */
  showLocation?: boolean;
}

/**
 * "Últimos status" da ficha: quem marcou No consultório, Último paciente etc., com data e hora.
 * Mesmo que o representante esqueça de marcar Visitado, o registro não se perde quando o status expira.
 */
export default function StatusHistory({ doctorId, statuses, profiles, initial = 4, showLocation = false }: StatusHistoryProps) {
  const [rows, setRows] = useState<StatusEventRow[] | null>(null);
  const [all, setAll] = useState(false);
  const stamp = statuses.map((s) => `${s.status_type}@${s.created_at}`).join('|');

  useEffect(() => {
    let cancelled = false;
    void fetchDoctorStatusEvents(doctorId).then((r) => {
      if (!cancelled) setRows(r ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [doctorId, stamp]);

  if (!rows || rows.length === 0) return null;
  const shown = all ? rows : rows.slice(0, initial);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Últimos status</span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {shown.map((e) => {
          const meta = STATUS_META[e.status_type];
          return (
            <li key={e.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
              <span className={`min-w-0 flex-1 truncate font-semibold ${meta?.text ?? 'text-slate-200'}`}>
                {meta?.label ?? e.status_type}
              </span>
              <span className="shrink-0 text-slate-300">{shortName(eventRepName(e, profiles))}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{dayTime(e.event_at)}</span>
              {showLocation && e.location_name && <span className="max-w-[28%] shrink-0 truncate text-slate-400">· {e.location_name}</span>}
            </li>
          );
        })}
      </ul>
      {rows.length > initial && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="self-start border-0 bg-transparent p-0 py-1 text-xs font-semibold text-slate-400 hover:underline"
        >
          {all ? 'Mostrar menos' : `Ver mais ${rows.length - initial}`}
        </button>
      )}
    </div>
  );
}
