'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import AgendaEditor from '@/components/AgendaEditor';
import ComboBox from '@/components/ComboBox';
import FormTitle from '@/components/FormTitle';
import type { ComboOption } from '@/components/ComboBox';
import type { DoctorLocation } from '@/types/doctor';
import { useGeolocation, GPS_ACTIVATE_LABEL, GPS_ADDRESS_FALLBACK_LABEL } from '@/hooks/useGeolocation';
import { mergeAddress } from '@/lib/geocode';

const fieldCls =
  'h-[52px] w-full min-w-0 box-border rounded-xl border border-slate-800 bg-slate-950 px-3.5 text-base text-slate-100 outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';

interface LocationSheetProps {
  /** null = novo local */
  initial: DoctorLocation | null;
  cityOptions: ComboOption[];
  onSave: (loc: DoctorLocation) => void;
  /** só para locais extras */
  onDelete?: () => void;
  onClose: () => void;
}

/** Folha "Novo local" / "Editar local": nome, endereço, GPS e a agenda daquele local. */
export default function LocationSheet({ initial, cityOptions, onSave, onDelete, onClose }: LocationSheetProps) {
  const [loc, setLoc] = useState<DoctorLocation>(
    initial ?? { id: `loc-${Date.now()}`, nome: '', endereco: '', numero: '', bairro: '', cidade: '', map_link: '', agenda: [] },
  );
  const gps = useGeolocation();
  const set = <K extends keyof DoctorLocation>(k: K, v: DoctorLocation[K]) => setLoc((p) => ({ ...p, [k]: v }));
  const canSave = loc.nome.trim().length > 0;

  return (
    <BottomSheet
      title={initial ? 'Editar local' : 'Novo local'}
      onClose={onClose}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-[52px] shrink-0 rounded-[14px] border border-slate-700 bg-transparent px-5 text-base font-medium text-slate-300 hover:text-white">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave({ ...loc, nome: loc.nome.trim() })}
            className="h-[52px] min-w-0 flex-1 rounded-[14px] border-0 bg-blue-600 text-base font-bold text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Salvar
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <FormTitle>Nome do local</FormTitle>
        <input type="text" value={loc.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Clínica, hospital, posto..." className={fieldCls} />
      </label>

      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <label className="flex flex-col gap-1.5">
          <FormTitle>Endereço</FormTitle>
          <input type="text" value={loc.endereco} onChange={(e) => set('endereco', e.target.value)} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <FormTitle>Número</FormTitle>
          <input type="text" inputMode="numeric" value={loc.numero} onChange={(e) => set('numero', e.target.value)} className={fieldCls} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <FormTitle>Bairro</FormTitle>
          <input type="text" value={loc.bairro} onChange={(e) => set('bairro', e.target.value)} className={fieldCls} />
        </label>
        <div className="flex flex-col gap-1.5">
          <FormTitle>Cidade</FormTitle>
          <ComboBox value={loc.cidade} onChange={(v) => set('cidade', v)} options={cityOptions} placeholder="Cidade" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FormTitle>GPS do local</FormTitle>
        <div className="flex gap-2">
          <input type="text" value={loc.map_link} onChange={(e) => set('map_link', e.target.value)} placeholder="Link do Google Maps" className={`${fieldCls} flex-1`} />
          <button
            type="button"
            disabled={gps.loading}
            onClick={() =>
              gps.capture((url) => set('map_link', url), {
                fallbackAddress: [[loc.endereco, loc.numero].filter(Boolean).join(', '), loc.bairro, loc.cidade].filter(Boolean).join(', '),
                onAddress: (a) => setLoc((p) => mergeAddress(p, a)),
              })
            }
            className="h-[52px] shrink-0 rounded-xl border border-blue-800 bg-blue-950 px-4 text-sm font-bold text-blue-600 disabled:opacity-50"
          >
            {gps.loading ? '...' : 'Usar GPS'}
          </button>
        </div>
        {gps.status && (
          <div role="status" className={`text-xs ${gps.status.type === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
            {gps.status.text}
          </div>
        )}
        {gps.needsActivation && (
          <button type="button" disabled={gps.loading} onClick={gps.retry} className="h-11 self-start rounded-xl border border-blue-800 bg-blue-950 px-4 text-sm font-semibold text-blue-600">
            {GPS_ACTIVATE_LABEL}
          </button>
        )}
        {gps.fallbackUrl && (
          <button type="button" onClick={gps.applyAddressFallback} className="h-11 self-start rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-semibold text-slate-200">
            {GPS_ADDRESS_FALLBACK_LABEL}
          </button>
        )}
      </div>

      <AgendaEditor value={loc.agenda} onChange={(a) => set('agenda', a)} />

      {onDelete && (
        <button type="button" onClick={onDelete} className="h-11 self-start border-0 bg-transparent px-1 text-sm font-semibold text-red-500">
          Excluir este local
        </button>
      )}
    </BottomSheet>
  );
}
