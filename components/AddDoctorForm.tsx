'use client';

import { useState, useCallback } from 'react';
import type { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, CATEGORIAS } from '@/constants';
import { parseDays, toggleDay } from '@/utils';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useGeolocation } from '@/hooks/useGeolocation';

/* ── Types ── */

interface AddDoctorFormProps {
  onAdd: (data: Partial<Doctor>) => Promise<boolean>;
  onCancel: () => void;
}

type FormState = {
  descricao: string;
  crm: string;
  especialidade: string;
  dias_semana: string;
  turno: string;
  complemento: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  telefone: string;
  email: string;
  map_link: string;
  observacoes: string;
  categoria: string;
};

const DEFAULTS: FormState = {
  descricao: '',
  crm: '',
  especialidade: '',
  dias_semana: '',
  turno: 'Manhã e Tarde',
  complemento: '',
  endereco: '',
  numero: '',
  bairro: '',
  cidade: '',
  telefone: '',
  email: '',
  map_link: '',
  observacoes: '',
  categoria: 'consultorio',
};

const inputCls =
  'w-full min-w-0 box-border p-2 rounded border border-slate-700 bg-slate-800 text-slate-100 text-xs outline-hidden placeholder:text-slate-500';

/* ── Component ── */

export default function AddDoctorForm({ onAdd, onCancel }: AddDoctorFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gps = useGeolocation();

  const { clearSaved, restored } = useFormPersistence('add_doctor', form, setForm, DEFAULTS);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleSubmit = async () => {
    if (!form.descricao.trim()) {
      setError('Nome do médico é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ok = await onAdd(form as Partial<Doctor>);
      if (ok) {
        clearSaved();
        setForm(DEFAULTS);
      } else {
        setError('Não foi possível adicionar. Tente novamente.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    clearSaved();
    onCancel();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col gap-2.5">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-white m-0">Novo Médico</h3>
        {restored && (
          <span className="text-[10px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">
            Rascunho restaurado
          </span>
        )}
      </div>

      {/* Nome e CRM */}
      <div className="grid grid-cols-[2fr_1fr] gap-1.5">
        <input
          type="text"
          placeholder="Nome do Médico *"
          value={form.descricao}
          onChange={(e) => setField('descricao', e.target.value)}
          className={inputCls}
          autoFocus
        />
        <input
          type="text"
          placeholder="CRM"
          value={form.crm}
          onChange={(e) => setField('crm', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Especialidade */}
      <input
        type="text"
        placeholder="Especialidade"
        value={form.especialidade}
        onChange={(e) => setField('especialidade', e.target.value)}
        className={inputCls}
      />

      {/* Categoria do Local */}
      <div>
        <span className="text-[10px] text-slate-500 block mb-[3px]">Categoria do Local:</span>
        <select
          value={form.categoria}
          onChange={(e) => setField('categoria', e.target.value)}
          className={inputCls}
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Dias de Atendimento */}
      <div>
        <span className="text-[10px] text-slate-500 block mb-[3px]">Dias de Atendimento:</span>
        <div className="flex gap-1">
          {OPCOES_DIAS.map((d) => {
            const isChecked = parseDays(form.dias_semana).includes(d.value);
            return (
              <button
                type="button"
                key={d.value}
                aria-pressed={isChecked}
                onClick={() => setField('dias_semana', toggleDay(form.dias_semana, d.value))}
                className={`flex-1 py-1.5 rounded border text-[10px] font-semibold ${
                  isChecked
                    ? 'border-blue-500 bg-blue-700 text-white'
                    : 'border-slate-700 bg-slate-800 text-slate-500'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clínica / Local */}
      <input
        type="text"
        placeholder="Clínica / Nome do Local"
        value={form.complemento}
        onChange={(e) => setField('complemento', e.target.value)}
        className={inputCls}
      />

      {/* Endereço + Número */}
      <div className="grid grid-cols-[2fr_1fr] gap-1.5">
        <input
          type="text"
          placeholder="Endereço"
          value={form.endereco}
          onChange={(e) => setField('endereco', e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Número"
          value={form.numero}
          onChange={(e) => setField('numero', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Bairro + Cidade */}
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="text"
          placeholder="Bairro"
          value={form.bairro}
          onChange={(e) => setField('bairro', e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Cidade"
          value={form.cidade}
          onChange={(e) => setField('cidade', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Telefone + Email */}
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="tel"
          placeholder="Telefone (WhatsApp)"
          value={form.telefone}
          onChange={(e) => setField('telefone', e.target.value)}
          className={inputCls}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Link GPS */}
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="Link GPS Maps"
          value={form.map_link}
          onChange={(e) => setField('map_link', e.target.value)}
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          disabled={gps.loading}
          onClick={() => gps.capture((url) => setField('map_link', url))}
          className="bg-green-700 text-white border-none px-3 rounded text-[11px] font-semibold shrink-0 hover:bg-green-600 disabled:opacity-50"
        >
          {gps.loading ? '...' : '📍 GPS'}
        </button>
      </div>
      {gps.status && (
        <div role="status" className={`text-[10px] ${gps.status.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
          {gps.status.text}
        </div>
      )}

      {/* Observações */}
      <input
        type="text"
        placeholder="Observações do Propagandista"
        value={form.observacoes}
        onChange={(e) => setField('observacoes', e.target.value)}
        className={inputCls}
      />

      {/* Erro */}
      {error && <div role="alert" className="text-[11px] text-red-400">{error}</div>}

      {/* Botões */}
      <div className="flex gap-2 justify-end mt-1">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 bg-slate-700 text-slate-300 border-none rounded text-xs hover:bg-slate-600"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit}
          className={`px-3 py-1.5 bg-blue-600 text-white border-none rounded text-xs font-semibold hover:bg-blue-500 ${
            saving ? 'opacity-70' : ''
          }`}
        >
          {saving ? 'Salvando...' : 'Adicionar Médico'}
        </button>
      </div>
    </div>
  );
}
