'use client';

import BottomSheet from '@/components/BottomSheet';
import type { Doctor } from '@/types/doctor';
import { formatTime, specialtyCode } from '@/utils';

export interface VisitedItem {
  doc: Doctor;
  /** quando este rep marcou a visita (ISO) */
  at: string;
}

interface VisitedSheetProps {
  /** "quinta", "hoje"... usado no título */
  dayLabel: string;
  items: readonly VisitedItem[];
  onClose: () => void;
  onOpen: (id: string) => void;
}

/** Lista dos médicos que o rep visitou no dia escolhido no filtro (o número do topo da tela abre esta folha) */
export default function VisitedSheet({ dayLabel, items, onClose, onOpen }: VisitedSheetProps) {
  return (
    <BottomSheet title={`Visitados ${dayLabel}`} onClose={onClose}>
      {items.length === 0 ? (
        <p className="m-0 py-8 text-center text-[13px] text-slate-400">Nenhum médico visitado neste dia.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {items.length} {items.length === 1 ? 'médico visitado' : 'médicos visitados'}
          </span>
          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-slate-800 p-0">
            {items.map(({ doc, at }) => (
              <li key={doc.id} className="border-t border-slate-800 first:border-t-0">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpen(doc.id);
                  }}
                  className="flex min-h-[60px] w-full items-center gap-3 border-0 bg-slate-900 px-4 py-2 text-left active:bg-slate-800"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-[13px] font-bold text-slate-950" aria-hidden="true">
                    ✓
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold uppercase text-white">{doc.descricao}</span>
                    <span className="truncate text-xs uppercase text-slate-400">
                      {[specialtyCode(doc.especialidade), doc.cidade].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-400">{formatTime(at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}
