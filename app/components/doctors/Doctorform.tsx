import { useState, type FormEvent } from 'react';
import type { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_TURNO } from '@/constants';
import { toggleDaySelection } from '@/utils/doctor';
import { LocateIcon, SpinnerIcon, XIcon } from '../ui/Icons';

interface DoctorFormProps {
  onAddDoctor: (doc: Partial<Doctor>) => Promise<boolean>;
  onClose: () => void;
  defaultTab: string;
  defaultCity: string;
}

const ringOnCard =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';
const fieldClass = 'flex min-w-0 flex-col gap-1.5 text-xs font-medium text-slate-300';
const wideFieldClass = `${fieldClass} sm:col-span-2`;
// 16px no mobile evita o zoom automático do iOS ao focar o campo.
const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-base font-normal text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-700 focus-visible:border-blue-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm';

export default function DoctorForm({ onAddDoctor, onClose, defaultTab, defaultCity }: DoctorFormProps) {
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    descricao: '',
    crm: '',
    dias_semana: defaultTab,
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
  const [gettingLocation, setGettingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateField = <K extends keyof Doctor>(field: K, value: Doctor[K]) => {
    setNewDoctor((current) => ({ ...current, [field]: value }));
  };

  const getCurrentLocation = (onSuccess: (url: string) => void) => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada.');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSuccess(`https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`);
        setGettingLocation(false);
      },
      () => {
        alert('Não foi possível obter sua localização.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateDoctor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newDoctor.descricao?.trim()) return;

    setSaving(true);
    try {
      const success = await onAddDoctor(newDoctor);
      if (success) onClose();
      else alert('Não foi possível cadastrar o médico.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleCreateDoctor}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
      aria-labelledby="doctor-form-title"
      className="mb-4 flex flex-col gap-5 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Novo cadastro</span>
          <h2 id="doctor-form-title" className="text-lg font-semibold tracking-tight text-slate-100">Adicionar médico</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar cadastro"
          className={`grid size-10 place-items-center rounded-xl border border-transparent text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-100 ${ringOnCard}`}
        >
          <XIcon className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={wideFieldClass}>
          <span>Nome do médico <span aria-hidden="true" className="text-blue-400">*</span></span>
          <input
            required
            autoFocus
            className={inputClass}
            value={newDoctor.descricao || ''}
            onChange={(event) => updateField('descricao', event.target.value)}
            placeholder="Nome completo"
          />
        </label>
        <label className={fieldClass}>
          CRM
          <input className={inputClass} value={newDoctor.crm || ''} onChange={(event) => updateField('crm', event.target.value)} placeholder="Número do CRM" />
        </label>
        <label className={fieldClass}>
          Telefone
          <input type="tel" inputMode="tel" className={inputClass} value={newDoctor.telefone || ''} onChange={(event) => updateField('telefone', event.target.value)} placeholder="(00) 00000-0000" />
        </label>
        <label className={fieldClass}>
          E-mail
          <input type="email" className={inputClass} value={newDoctor.email || ''} onChange={(event) => updateField('email', event.target.value)} placeholder="contato@clinica.com" />
        </label>

        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="mb-1.5 text-xs font-medium text-slate-300">Dias de atendimento</legend>
          <div className="flex gap-1.5">
            {OPCOES_DIAS.map((day) => {
              const selected = (newDoctor.dias_semana || '').toLowerCase().split(',').map((value) => value.trim()).includes(day.value);
              return (
                <button
                  type="button"
                  key={day.value}
                  aria-pressed={selected}
                  onClick={() => updateField('dias_semana', toggleDaySelection(newDoctor.dias_semana, day.value))}
                  className={`min-h-10 flex-1 rounded-lg border px-1 text-xs font-semibold transition-colors ${ringOnCard} ${
                    selected
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className={fieldClass}>
          Turno
          <select className={inputClass} value={newDoctor.turno || 'Manhã e Tarde'} onChange={(event) => updateField('turno', event.target.value)}>
            {OPCOES_TURNO.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
          </select>
        </label>
        <label className={fieldClass}>
          Clínica / local
          <input className={inputClass} value={newDoctor.complemento || ''} onChange={(event) => updateField('complemento', event.target.value)} placeholder="Nome da clínica" />
        </label>
        <label className={fieldClass}>
          Cidade / estado
          <input className={inputClass} value={newDoctor.cidade || ''} onChange={(event) => updateField('cidade', event.target.value)} placeholder="Cidade - UF" />
        </label>
        <label className={fieldClass}>
          Bairro
          <input className={inputClass} value={newDoctor.bairro || ''} onChange={(event) => updateField('bairro', event.target.value)} placeholder="Bairro" />
        </label>
        <label className={wideFieldClass}>
          Endereço
          <input className={inputClass} value={newDoctor.endereco || ''} onChange={(event) => updateField('endereco', event.target.value)} placeholder="Rua ou avenida" />
        </label>
        <label className={fieldClass}>
          Número
          <input className={inputClass} value={newDoctor.numero || ''} onChange={(event) => updateField('numero', event.target.value)} placeholder="Nº" />
        </label>
        <label className={fieldClass}>
          Link do mapa
          <input className={inputClass} value={newDoctor.map_link || ''} onChange={(event) => updateField('map_link', event.target.value)} placeholder="https://..." />
        </label>
        <label className={wideFieldClass}>
          Observações
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={newDoctor.observacoes || ''}
            onChange={(event) => updateField('observacoes', event.target.value)}
            placeholder="Informações úteis para a visita"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={gettingLocation}
          onClick={() => getCurrentLocation((url) => updateField('map_link', url))}
          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto ${ringOnCard}`}
        >
          {gettingLocation ? <SpinnerIcon className="size-4 animate-spin" /> : <LocateIcon className="size-4" />}
          {gettingLocation ? 'Obtendo localização...' : 'Usar minha localização'}
        </button>
        <button
          type="submit"
          disabled={saving}
          className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60 sm:w-auto ${ringOnCard}`}
        >
          {saving && <SpinnerIcon className="size-4 animate-spin" />}
          {saving ? 'Salvando...' : 'Salvar médico'}
        </button>
      </div>
    </form>
  );
}
