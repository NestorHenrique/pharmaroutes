'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { DoctorStatusType } from '@/types/status';

export interface LiveGroup {
  type: DoctorStatusType;
  title: string;
  docs: { id: string; name: string; place: string; ago: string }[];
}

const TONE: Partial<Record<DoctorStatusType, { chip: string; dot: string; badge: string }>> = {
  representante_no_consultorio: { chip: 'border-sky-500/50 bg-sky-500/10', dot: 'bg-sky-500', badge: 'bg-sky-500 text-slate-950' },
  ultimo_paciente: { chip: 'border-red-500/50 bg-red-500/10', dot: 'bg-red-500', badge: 'bg-red-500 text-slate-950' },
  aguardando_medico: { chip: 'border-amber-400/50 bg-amber-400/10', dot: 'bg-amber-400', badge: 'bg-amber-400 text-slate-950' },
};
const FALLBACK = { chip: 'border-slate-700 bg-slate-900', dot: 'bg-slate-500', badge: 'bg-slate-700 text-slate-100' };

/** Faixa "Ao vivo": uma ficha por status com a contagem; tocar abre a lista dos médicos. */
export default function LiveStrip({ groups, onOpenDoctor }: { groups: LiveGroup[]; onOpenDoctor: (id: string) => void }) {
  const [openType, setOpenType] = useState<DoctorStatusType | null>(null);
  const open = groups.find((g) => g.type === openType) ?? null;
  if (groups.length === 0) return null;

  return (
    <section aria-label="Acontecendo agora" className="flex flex-col gap-2">
      <div className="mt-1 flex items-center gap-2">
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-600 opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-blue-600" />
        </span>
        <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-100">Ao vivo</h2>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
        {groups.map((g) => {
          const t = TONE[g.type] ?? FALLBACK;
          return (
            <button
              key={g.type}
              type="button"
              onClick={() => setOpenType(g.type)}
              aria-label={`${g.title}: ${g.docs.length} ${g.docs.length === 1 ? 'médico' : 'médicos'}. Ver lista`}
              className={`flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border pl-3 pr-2.5 text-[13px] font-semibold text-slate-100 ${t.chip}`}
            >
              <span className={`size-2 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
              {g.title}
              <span className={`grid h-[22px] min-w-[22px] place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums ${t.badge}`}>{g.docs.length}</span>
              <span className="text-xs font-medium text-slate-400">{g.docs[0]?.ago}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          );
        })}
      </div>

      {open && (
        <BottomSheet title={`${open.title} · ${open.docs.length}`} onClose={() => setOpenType(null)}>
          <div className="-mt-1 flex flex-col">
            {open.docs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setOpenType(null);
                  onOpenDoctor(d.id);
                }}
                className="flex min-h-[60px] w-full items-center gap-3 border-0 border-t border-slate-800 bg-transparent py-2 text-left first:border-t-0"
              >
                <span className={`size-2.5 shrink-0 rounded-full ${(TONE[open.type] ?? FALLBACK).dot}`} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold uppercase text-white">{d.name}</span>
                  <span className="truncate text-xs uppercase text-slate-400">{d.place}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-400">{d.ago}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </section>
  );
}
