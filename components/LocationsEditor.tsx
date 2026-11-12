'use client';

import { useState } from 'react';
import LocationSheet from '@/components/LocationSheet';
import FormTitle from '@/components/FormTitle';
import type { ComboOption } from '@/components/ComboBox';
import type { DoctorLocation } from '@/types/doctor';
import { locationAddress } from '@/lib/locations';

interface LocationsEditorProps {
  /** Local 1, montado com os campos do formulário */
  principal: DoctorLocation;
  onPrincipalChange: (loc: DoctorLocation) => void;
  extras: readonly DoctorLocation[];
  onExtrasChange: (next: DoctorLocation[]) => void;
  cityOptions: ComboOption[];
}

type Editing = { kind: 'principal' } | { kind: 'extra'; id: string } | { kind: 'new' } | null;

/** Seção "Locais" da edição do médico: lista, editar e "Adicionar local". */
export default function LocationsEditor({ principal, onPrincipalChange, extras, onExtrasChange, cityOptions }: LocationsEditorProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const all = [principal, ...extras];
  const current =
    editing?.kind === 'principal' ? principal : editing?.kind === 'extra' ? extras.find((e) => e.id === editing.id) ?? null : null;

  return (
    <div className="flex flex-col gap-2">
      <FormTitle>Locais</FormTitle>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {all.map((l, i) => (
          <li key={l.id} className="flex min-h-14 items-center gap-2 rounded-[14px] border border-slate-800 bg-slate-900 py-1.5 pl-3 pr-1.5">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-slate-100">
                {l.nome || 'Sem nome'}
                <span className="ml-1.5 text-[11px] font-medium text-slate-400">{i === 0 ? 'Local 1 · principal' : `Local ${i + 1}`}</span>
              </span>
              <span className="truncate text-xs text-slate-400">{locationAddress(l)}</span>
            </span>
            <button
              type="button"
              aria-label={`Editar ${l.nome || `local ${i + 1}`}`}
              onClick={() => setEditing(i === 0 ? { kind: 'principal' } : { kind: 'extra', id: l.id })}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-transparent text-slate-300 hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEditing({ kind: 'new' })}
        className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-dashed border-slate-700 bg-transparent text-base font-semibold text-blue-600"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Adicionar local
      </button>

      {editing && (
        <LocationSheet
          initial={editing.kind === 'new' ? null : current}
          cityOptions={cityOptions}
          onClose={() => setEditing(null)}
          onSave={(loc) => {
            if (editing.kind === 'principal') onPrincipalChange({ ...loc, id: principal.id, principal: true });
            else if (editing.kind === 'extra') onExtrasChange(extras.map((e) => (e.id === loc.id ? loc : e)));
            else onExtrasChange([...extras, loc]);
            setEditing(null);
          }}
          onDelete={
            editing.kind === 'extra'
              ? () => {
                  onExtrasChange(extras.filter((e) => e.id !== editing.id));
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
