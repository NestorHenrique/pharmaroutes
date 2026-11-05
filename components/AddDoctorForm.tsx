'use client';

import { useState, type FormEvent } from 'react';
import type { Doctor } from '@/types/doctor';
import { OPCOES_DIAS } from '@/constants';
import { parseDays, toggleDay } from '@/utils';
import { useGeolocation } from '@/hooks/useGeolocation';

interface AddDoctorFormProps {
  defaultDay: string;
  defaultCity: string;
  saving: boolean;
  onSubmit: (data: Partial<Doctor>) => Promise<boolean>;
}

const inputCls =
  'w-full min-w-0 box-border p-2 rounded-md border border-slate-800 bg-slate-950 text-slate-100 text-xs outline-hidden placeholder:text-slate-500';

export default function AddDoctorForm({ defaultDay, defaultCity, saving, onSubmit }: AddDoctorFormProps) {
  const [form, setForm] = useState<Partial<Doctor>>({
    descricao: '',
    crm: '',
    dias_semana: defaultDay,
    cidade: defaultCity,
    bairro: '',
    endereco: '',
    numero: '',
    complemento: '',
    turno: 'Manhã e Tarde',
    observacoes: '',
    telefone: '',
    email: '',
    map_link: '',
  });
  const gps = useGeolocation();

  const set = <K extends keyof Doctor>(key: K, value: Doctor[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.descricao?.trim();
    if (!name) return;
    await onSubmit({ ...form, descricao: name });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-4 flex flex-col gap-2.5"
    >
      <h3 className="m-0 text-sm text-blue-400 font-semibold">Cadastrar Novo Médico</h3>

      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <input type="text" required placeholder="Nome do Médico *" value={form.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} className={inputCls} />
        <input type="text" placeholder="CRM" value={form.crm ?? ''} onChange={(e) => set('crm', e.target.value)} className={inputCls} />
      </div>

      <div>
        <span className="text-[11px] text-slate-400 block mb-1">Dias de Atendimento:</span>
        <div className="flex gap-1">
          {OPCOES_DIAS.map((d) => {
            const isChecked = parseDays(form.dias_semana).includes(d.value);
            return (
              <button
                type="button"
                key={d.value}
                aria-pressed={isChecked}
                onClick={() => set('dias_semana', toggleDay(form.dias_semana, d.value))}
                className={`flex-1 py-[5px] rounded border text-[11px] font-semibold ${
                  isChecked
                    ? 'border-blue-500 bg-blue-700 text-white'
                    : 'border-slate-700 bg-slate-950 text-slate-500'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input type="tel" placeholder="Telefone / WhatsApp" value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} className={inputCls} />
        <input type="text" placeholder="Cidade" value={form.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Bairro" value={form.bairro ?? ''} onChange={(e) => set('bairro', e.target.value)} className={inputCls} />
        <input type="text" placeholder="Clínica / Consultório" value={form.complemento ?? ''} onChange={(e) => set('complemento', e.target.value)} className={inputCls} />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <input type="text" placeholder="Logradouro / Endereço" value={form.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} className={inputCls} />
        <input type="text" placeholder="Número" value={form.numero ?? ''} onChange={(e) => set('numero', e.target.value)} className={inputCls} />
      </div>

      <div className="flex gap-1.5">
        <input type="text" placeholder="Link do Maps ou clique ao lado" value={form.map_link ?? ''} onChange={(e) => set('map_link', e.target.value)} className={`${inputCls} flex-1`} />
        <button
          type="button"
          disabled={gps.loading}
          onClick={() => gps.capture((url) => set('map_link', url))}
          className="bg-green-700 text-white border-none px-2.5 rounded-md text-[11px] font-semibold shrink-0 hover:bg-green-600 disabled:opacity-50"
        >
          {gps.loading ? '...' : 'GPS Atual'}
        </button>
      </div>
      {gps.status && (
        <div role="status" className={`text-[11px] ${gps.status.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
          {gps.status.text}
        </div>
      )}

      <input type="text" placeholder="Observações" value={form.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} className={inputCls} />

      <button
        type="submit"
        disabled={saving}
        className={`bg-blue-600 text-white border-none rounded-md text-xs font-semibold p-2 mt-1 hover:bg-blue-500 ${saving ? 'opacity-70' : ''}`}
      >
        {saving ? 'Salvando...' : 'Salvar Cadastro'}
      </button>
    </form>
  );
}
