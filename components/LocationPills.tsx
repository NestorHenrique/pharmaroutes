'use client';

import type { DoctorLocation } from '@/types/doctor';
import { locationAddress, locationWhen } from '@/lib/locations';

interface LocationPillsProps {
  locais: readonly DoctorLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
  onNavigate: (loc: DoctorLocation) => void;
  /** card esmaecido (indisponível) */
  muted?: boolean;
}

/**
 * Médico com 2 ou mais locais: uma pílula por local. A selecionada é o "Local de hoje" (violeta, borda 2px);
 * a outra mostra quando o médico atende lá. Embaixo: endereço do local escolhido, ajuda e GPS.
 */
export default function LocationPills({ locais, selectedId, onSelect, onNavigate, muted = false }: LocationPillsProps) {
  const sel = locais.find((l) => l.id === selectedId) ?? locais[0];
  const canNavigate = Boolean(sel.map_link.trim() || sel.endereco);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Locais de atendimento">
        {locais.map((l) => {
          const on = l.id === sel.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(l.id)}
              className={`flex min-h-14 min-w-0 flex-col items-start justify-center gap-0.5 rounded-[14px] px-3 py-2 text-left ${
                on ? 'border-2 border-blue-600 bg-blue-900 text-blue-200' : 'border border-slate-700 bg-slate-950 text-slate-300'
              }`}
            >
              <span className="w-full truncate text-[13px] font-bold leading-tight">{l.nome}</span>
              <span className={`w-full truncate text-[11px] ${on ? 'font-semibold text-blue-200' : 'text-slate-400'}`}>
                {on ? 'Local de hoje' : locationWhen(l)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-slate-300">
        <div className="font-medium text-slate-200">{locationAddress(sel)}</div>
        {sel.cidade && <div className="font-semibold text-blue-400">{sel.cidade.toUpperCase()}</div>}
      </div>

      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs text-slate-400">
          Atende em {locais.length} locais. Toque no outro para trocar hoje.
        </span>
        <button
          type="button"
          onClick={() => onNavigate(sel)}
          disabled={!canNavigate || muted}
          className="h-11 shrink-0 rounded-xl border border-blue-800 bg-blue-950 px-4 text-sm font-bold text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sel.map_link ? 'GPS fixo' : 'GPS'}
        </button>
      </div>
    </div>
  );
}
