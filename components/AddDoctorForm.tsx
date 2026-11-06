'use client';

import { useState, useCallback } from 'react';
import type { AddDoctorResult, AgendaEntry, Doctor } from '@/types/doctor';
import { CATEGORIAS, ESPECIALIDADES } from '@/constants';
import { sortAgenda, specialtyCode } from '@/utils';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useGeolocation } from '@/hooks/useGeolocation';
import AgendaEditor from '@/components/AgendaEditor';
import ComboBox from '@/components/ComboBox';
import type { ComboOption } from '@/components/ComboBox';

const SPECIALTY_OPTIONS: ComboOption[] = ESPECIALIDADES.map((e) => ({
  value: e.label,
  label: e.label,
  hint: e.code,
}));

/* ── Types ── */

interface AddDoctorFormProps {
  onAdd: (data: Partial<Doctor>) => Promise<AddDoctorResult>;
  onLinkPortfolio: (doctorId: string) => Promise<boolean>;
  isInPortfolio: (doctorId: string) => boolean;
  onCancel: () => void;
  /** cidades da base (grafia oficial) */
  cityOptions: ComboOption[];
}

type FormState = {
  descricao: string;
  crm: string;
  uf: string;
  especialidade: string;
  agenda: AgendaEntry[];
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
  uf: 'PI',
  especialidade: '',
  agenda: [],
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

export default function AddDoctorForm({ onAdd, onLinkPortfolio, isInPortfolio, onCancel, cityOptions }: AddDoctorFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Doctor | null>(null);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const gps = useGeolocation();

  const { clearSaved, restored } = useFormPersistence('add_doctor', form, setForm, DEFAULTS);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (key === 'crm' || key === 'uf') {
        setDuplicate(null);
        setLinkMsg(null);
      }
    },
    [],
  );

  const handleSubmit = async () => {
    if (!form.descricao.trim()) {
      setError('Nome do médico é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    setDuplicate(null);
    setLinkMsg(null);

    const payload: Partial<Doctor> = {
      descricao: form.descricao.trim(),
      crm: form.crm.trim(),
      uf: form.uf.trim().toUpperCase() || 'PI',
      especialidade: form.especialidade.trim() || null,
      agenda: sortAgenda(form.agenda || []),
      complemento: form.complemento.trim(),
      endereco: form.endereco.trim(),
      numero: form.numero.trim(),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      telefone: form.telefone.trim(),
      email: form.email.trim(),
      map_link: form.map_link.trim(),
      observacoes: form.observacoes.trim(),
      categoria: form.categoria as Doctor['categoria'],
    };

    try {
      const result = await onAdd(payload);
      if (result.ok) {
        clearSaved();
        setForm(DEFAULTS);
      } else {
        setError(result.error);
        if (result.duplicate) setDuplicate(result.duplicate);
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async () => {
    if (!duplicate) return;
    const ok = await onLinkPortfolio(duplicate.id);
    if (ok) {
      clearSaved();
      setLinkMsg('Vinculado à sua carteira. Ele já aparece na sua lista.');
    } else {
      setLinkMsg('Não foi possível vincular. A migração v3 já foi rodada?');
    }
  };

  const handleCancel = () => {
    clearSaved();
    onCancel();
  };

  const code = specialtyCode(form.especialidade);

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

      {/* Nome */}
      <input
        type="text"
        placeholder="Nome do Médico *"
        value={form.descricao}
        onChange={(e) => setField('descricao', e.target.value)}
        className={inputCls}
        autoFocus
      />

      {/* CRM + UF */}
      <div className="grid grid-cols-[2fr_1fr] gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          placeholder="CRM"
          value={form.crm}
          onChange={(e) => setField('crm', e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="UF"
          maxLength={2}
          value={form.uf}
          onChange={(e) => setField('uf', e.target.value.toUpperCase())}
          className={`${inputCls} uppercase`}
        />
      </div>

      {/* Especialidade + sigla */}
      <div className="grid grid-cols-[1fr_auto] gap-1.5 items-center">
        <ComboBox
          value={form.especialidade}
          onChange={(v) => setField('especialidade', v)}
          options={SPECIALTY_OPTIONS}
          placeholder="Especialidade"
        />
        <span className="text-[10px] px-1.5 py-1 rounded-sm font-bold bg-rose-900 text-rose-200 min-w-9 text-center">
          {code ?? '—'}
        </span>
      </div>

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

      {/* Dias + turno por dia */}
      <AgendaEditor value={form.agenda || []} onChange={(a) => setField('agenda', a)} />

      {/* Clínica / Local */}
      <input
        type="text"
        placeholder="Clínica / Local (PSM, SAMU, Hospital...)"
        value={form.complemento}
        onChange={(e) => setField('complemento', e.target.value)}
        className={inputCls}
      />

      {/* Endereço + Número */}
      <div className="grid grid-cols-[2fr_1fr] gap-1.5">
        <input type="text" placeholder="Endereço" value={form.endereco} onChange={(e) => setField('endereco', e.target.value)} className={inputCls} />
        <input type="text" placeholder="Número" value={form.numero} onChange={(e) => setField('numero', e.target.value)} className={inputCls} />
      </div>

      {/* Bairro + Cidade */}
      <div className="grid grid-cols-2 gap-1.5">
        <input type="text" placeholder="Bairro" value={form.bairro} onChange={(e) => setField('bairro', e.target.value)} className={inputCls} />
        <ComboBox
          value={form.cidade}
          onChange={(v) => setField('cidade', v)}
          options={cityOptions}
          placeholder="Cidade"
        />
      </div>

      {/* Telefone + Email */}
      <div className="grid grid-cols-2 gap-1.5">
        <input type="tel" placeholder="Telefone (WhatsApp)" value={form.telefone} onChange={(e) => setField('telefone', e.target.value)} className={inputCls} />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputCls} />
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

      {/* Duplicado: oferece vincular à carteira */}
      {duplicate ? (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-2.5 flex flex-col gap-1.5">
          <strong className="text-[12px] text-red-300">Médico já cadastrado na base de dados</strong>
          <span className="text-[11px] text-slate-300">
            {duplicate.descricao}
            {duplicate.crm && ` · CRM ${duplicate.crm}${duplicate.uf ? `/${duplicate.uf}` : ''}`}
            {duplicate.complemento && ` · ${duplicate.complemento}`}
            {duplicate.cidade && ` · ${duplicate.cidade}`}
          </span>
          {isInPortfolio(duplicate.id) || linkMsg?.startsWith('Vinculado') ? (
            <span className="text-[11px] text-emerald-400">{linkMsg ?? 'Este médico já está na sua carteira.'}</span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleLink}
                className="px-2.5 py-1 bg-emerald-600 text-white border-none rounded text-[11px] font-semibold hover:bg-emerald-500"
              >
                Vincular à minha carteira
              </button>
              {linkMsg && <span className="text-[11px] text-amber-400">{linkMsg}</span>}
            </div>
          )}
        </div>
      ) : (
        error && <div role="alert" className="text-[11px] text-red-400">{error}</div>
      )}

      {/* Botões */}
      <div className="flex gap-2 justify-end mt-1">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 bg-slate-700 text-slate-300 border-none rounded text-xs hover:bg-slate-600"
        >
          {duplicate ? 'Fechar' : 'Cancelar'}
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
