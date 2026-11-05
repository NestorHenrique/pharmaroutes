import { useState, type FormEvent } from 'react';
import type { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_TURNO } from '@/constants';

interface DoctorFormProps {
  onAddDoctor: (doc: Partial<Doctor>) => Promise<boolean>;
  onClose: () => void;
  defaultTab: string;
  defaultCity: string;
}

function toggleDaySelection(currentDays = '', dayValue: string) {
  const days = currentDays.toLowerCase().split(',').map((day) => day.trim()).filter(Boolean);
  return (days.includes(dayValue)
    ? days.filter((day) => day !== dayValue)
    : [...days, dayValue]
  ).join(', ');
}

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
    <form className="doctor-form" onSubmit={handleCreateDoctor}>
      <div className="doctor-form-heading">
        <div>
          <span className="doctor-eyebrow">Novo cadastro</span>
          <h2>Adicionar médico</h2>
        </div>
        <button type="button" className="doctor-icon-button" onClick={onClose} aria-label="Fechar cadastro">
          ×
        </button>
      </div>

      <div className="doctor-form-grid">
        <label className="doctor-form-field doctor-form-field-wide">
          Nome do médico
          <input required value={newDoctor.descricao || ''} onChange={(event) => updateField('descricao', event.target.value)} placeholder="Nome completo" />
        </label>
        <label className="doctor-form-field">
          CRM
          <input value={newDoctor.crm || ''} onChange={(event) => updateField('crm', event.target.value)} placeholder="Número do CRM" />
        </label>
        <label className="doctor-form-field">
          Telefone
          <input value={newDoctor.telefone || ''} onChange={(event) => updateField('telefone', event.target.value)} placeholder="(00) 00000-0000" />
        </label>
        <label className="doctor-form-field">
          E-mail
          <input type="email" value={newDoctor.email || ''} onChange={(event) => updateField('email', event.target.value)} placeholder="contato@clinica.com" />
        </label>
        <label className="doctor-form-field doctor-form-field-wide">
          Dias de atendimento
          <div className="doctor-form-days">
            {OPCOES_DIAS.map((day) => {
              const selected = (newDoctor.dias_semana || '').toLowerCase().split(',').map((value) => value.trim()).includes(day.value);
              return (
                <button
                  type="button"
                  key={day.value}
                  className={selected ? 'doctor-form-day doctor-form-day-active' : 'doctor-form-day'}
                  aria-pressed={selected}
                  onClick={() => updateField('dias_semana', toggleDaySelection(newDoctor.dias_semana, day.value))}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </label>
        <label className="doctor-form-field">
          Turno
          <select value={newDoctor.turno || 'Manhã e Tarde'} onChange={(event) => updateField('turno', event.target.value)}>
            {OPCOES_TURNO.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
          </select>
        </label>
        <label className="doctor-form-field">
          Clínica / local
          <input value={newDoctor.complemento || ''} onChange={(event) => updateField('complemento', event.target.value)} placeholder="Nome da clínica" />
        </label>
        <label className="doctor-form-field">
          Cidade / estado
          <input value={newDoctor.cidade || ''} onChange={(event) => updateField('cidade', event.target.value)} placeholder="Cidade - UF" />
        </label>
        <label className="doctor-form-field">
          Bairro
          <input value={newDoctor.bairro || ''} onChange={(event) => updateField('bairro', event.target.value)} placeholder="Bairro" />
        </label>
        <label className="doctor-form-field doctor-form-field-wide">
          Endereço
          <input value={newDoctor.endereco || ''} onChange={(event) => updateField('endereco', event.target.value)} placeholder="Rua ou avenida" />
        </label>
        <label className="doctor-form-field">
          Número
          <input value={newDoctor.numero || ''} onChange={(event) => updateField('numero', event.target.value)} placeholder="Nº" />
        </label>
        <label className="doctor-form-field">
          Link do mapa
          <input value={newDoctor.map_link || ''} onChange={(event) => updateField('map_link', event.target.value)} placeholder="https://..." />
        </label>
        <label className="doctor-form-field doctor-form-field-wide">
          Observações
          <textarea value={newDoctor.observacoes || ''} onChange={(event) => updateField('observacoes', event.target.value)} placeholder="Informações úteis para a visita" />
        </label>
      </div>

      <div className="doctor-form-actions">
        <button
          type="button"
          className="doctor-secondary-button"
          disabled={gettingLocation}
          onClick={() => getCurrentLocation((url) => updateField('map_link', url))}
        >
          {gettingLocation ? 'Obtendo localização...' : 'Usar minha localização'}
        </button>
        <button type="submit" className="doctor-primary-button" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar médico'}
        </button>
      </div>
    </form>
  );
}
