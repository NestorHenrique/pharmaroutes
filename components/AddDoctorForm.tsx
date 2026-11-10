'use client';

import { useState, useCallback } from 'react';
import type { AddDoctorResult, AgendaEntry, Doctor } from '@/types/doctor';
import { CYCLE_WEEKS, cycleWeekLabel, normalizeCycleWeeks } from '@/types/doctor';
import { CATEGORIAS, ESPECIALIDADES } from '@/constants';
import { normalizeCrm, sortAgenda, specialtyCode } from '@/utils';
import { lookupCrm } from '@/lib/crmLookup';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useGeolocation, GPS_ACTIVATE_LABEL, GPS_ADDRESS_FALLBACK_LABEL } from '@/hooks/useGeolocation';
import { mergeAddress } from '@/lib/geocode';
import AgendaEditor from '@/components/AgendaEditor';
import ComboBox from '@/components/ComboBox';
import FormTitle from '@/components/FormTitle';
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
  /** CRM + UF já cadastrado? Usado antes da busca, para não buscar quem já está na base */
  findDuplicate?: (crm: string, uf: string) => Doctor | undefined;
}

type FormState = {
  descricao: string;
  crm: string;
  uf: string;
  especialidade: string;
  rqe: string;
  agenda: AgendaEntry[];
  complemento: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  telefone: string;
  whatsapp_medico: string;
  whatsapp_clinica: string;
  email: string;
  map_link: string;
  observacoes: string;
  categoria: string;
  cycle_weeks: number[];
};

const DEFAULTS: FormState = {
  descricao: '',
  crm: '',
  uf: 'PI',
  especialidade: '',
  rqe: '',
  agenda: [],
  complemento: '',
  endereco: '',
  numero: '',
  bairro: '',
  cidade: '',
  telefone: '',
  whatsapp_medico: '',
  whatsapp_clinica: '',
  email: '',
  map_link: '',
  observacoes: '',
  categoria: 'consultorio',
  cycle_weeks: [],
};

const inputCls =
  'w-full min-w-0 box-border h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base sm:text-sm outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';

/* ── Component ── */

export default function AddDoctorForm({ onAdd, onLinkPortfolio, isInPortfolio, onCancel, cityOptions, findDuplicate }: AddDoctorFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Doctor | null>(null);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const gps = useGeolocation();

  const { clearSaved, restored } = useFormPersistence('add_doctor', form, setForm, DEFAULTS);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (key === 'crm' || key === 'uf') {
        setDuplicate(null);
        setLinkMsg(null);
        setLookupMsg(null);
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
    // Só envia se marcado/preenchido (funciona mesmo antes das migrações v5 e v6)
    const weeks = normalizeCycleWeeks(form.cycle_weeks);
    if (weeks.length) payload.cycle_weeks = weeks;
    if (form.rqe.trim()) payload.rqe = form.rqe.trim();
    if (form.whatsapp_medico.trim()) payload.whatsapp_medico = form.whatsapp_medico.trim();
    if (form.whatsapp_clinica.trim()) payload.whatsapp_clinica = form.whatsapp_clinica.trim();

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

  /** "Buscar Dados do CRM": confere a base local e depois consulta o CRM (nome, especialidade, RQE) */
  const handleLookup = async () => {
    setError(null);
    setLookupMsg(null);
    if (!normalizeCrm(form.crm)) {
      setLookupMsg({ type: 'error', text: 'Digite o CRM para buscar.' });
      return;
    }
    const dup = findDuplicate?.(form.crm, form.uf);
    if (dup) {
      setDuplicate(dup); // mostra o aviso de "já cadastrado" com o botão de vincular à carteira
      return;
    }
    setLooking(true);
    try {
      const res = await lookupCrm(form.crm, form.uf);
      if (!res.ok) {
        setLookupMsg({ type: 'error', text: res.message });
        return;
      }
      const { nome, especialidade, rqe } = res.data;
      setForm((prev) => ({
        ...prev,
        descricao: nome ? nome.toUpperCase() : prev.descricao,
        especialidade: especialidade || prev.especialidade,
        rqe: rqe || prev.rqe,
      }));
      const filled = [nome && 'nome', especialidade && 'especialidade', rqe && 'RQE'].filter(Boolean).join(', ');
      setLookupMsg({ type: 'ok', text: `Preenchido: ${filled}. Confira antes de salvar.` });
    } finally {
      setLooking(false);
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold tracking-tight text-white m-0">Novo médico</h3>
        {restored && (
          <span className="text-[10px] text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">
            Rascunho restaurado
          </span>
        )}
      </div>

      {/* CRM + UF no topo: com eles a busca preenche o resto */}
      <div className="grid grid-cols-[2fr_1fr] gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          placeholder="CRM"
          aria-label="CRM"
          value={form.crm}
          onChange={(e) => setField('crm', e.target.value)}
          className={inputCls}
          autoFocus
        />
        <input
          type="text"
          placeholder="UF"
          aria-label="UF"
          maxLength={2}
          value={form.uf}
          onChange={(e) => setField('uf', e.target.value.toUpperCase())}
          className={`${inputCls} uppercase`}
        />
      </div>
      <button
        type="button"
        disabled={looking || !normalizeCrm(form.crm)}
        onClick={handleLookup}
        className="h-11 rounded-xl border border-blue-600 bg-transparent text-sm font-semibold text-blue-400 hover:bg-blue-600/10 disabled:opacity-40"
      >
        {looking ? 'Buscando…' : 'Buscar Dados do CRM'}
      </button>
      {lookupMsg && (
        <div role="status" className={`text-[11px] ${lookupMsg.type === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
          {lookupMsg.text}
        </div>
      )}

      {/* Nome */}
      <input
        type="text"
        placeholder="Nome do Médico *"
        value={form.descricao}
        onChange={(e) => setField('descricao', e.target.value.toUpperCase())}
        className={inputCls}
      />

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

      {/* RQE */}
      <input
        type="text"
        inputMode="numeric"
        placeholder="RQE (opcional)"
        aria-label="RQE"
        value={form.rqe}
        onChange={(e) => setField('rqe', e.target.value)}
        className={inputCls}
      />

      {/* Categoria do Local */}
      <div>
        <div className="mb-1.5">
          <FormTitle>Categoria do local</FormTitle>
        </div>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Categoria do local">
          {CATEGORIAS.map((c) => {
            const on = form.categoria === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setField('categoria', c.value)}
                className={`h-11 rounded-xl text-sm ${
                  on ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dias + turno por dia */}
      <AgendaEditor value={form.agenda || []} onChange={(a) => setField('agenda', a)} />

      {/* Semanas do ciclo */}
      <div>
        <div className="mb-1.5">
          <FormTitle>Semanas do ciclo</FormTitle>
        </div>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Semanas do ciclo">
          {CYCLE_WEEKS.map((w) => {
            const on = (form.cycle_weeks ?? []).includes(w);
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => setField('cycle_weeks', normalizeCycleWeeks(on ? (form.cycle_weeks ?? []).filter((x) => x !== w) : [...(form.cycle_weeks ?? []), w]))}
                className={`h-11 rounded-xl text-sm font-semibold ${
                  on ? 'border-0 bg-blue-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                {cycleWeekLabel(w)}
              </button>
            );
          })}
        </div>
      </div>

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

      {/* WhatsApps (médico e clínica, separados) */}
      <div className="grid grid-cols-2 gap-1.5">
        <input type="tel" inputMode="tel" placeholder="WhatsApp médico" value={form.whatsapp_medico} onChange={(e) => setField('whatsapp_medico', e.target.value)} className={inputCls} />
        <input type="tel" inputMode="tel" placeholder="WhatsApp clínica" value={form.whatsapp_clinica} onChange={(e) => setField('whatsapp_clinica', e.target.value)} className={inputCls} />
      </div>

      {/* Telefone + Email */}
      <div className="grid grid-cols-2 gap-1.5">
        <input type="tel" placeholder="Telefone fixo" value={form.telefone} onChange={(e) => setField('telefone', e.target.value)} className={inputCls} />
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
          onClick={() =>
            gps.capture((url) => setField('map_link', url), {
              fallbackAddress: [[form.endereco, form.numero].filter(Boolean).join(', '), form.bairro, form.cidade]
                .filter(Boolean)
                .join(', '),
              // Toque no GPS também busca endereço, bairro e cidade do ponto atual
              onAddress: (a) => setForm((prev) => mergeAddress(prev, a)),
            })
          }
          className="bg-green-700 text-white border-none px-3 rounded text-[11px] font-semibold shrink-0 hover:bg-green-600 disabled:opacity-50"
        >
          {gps.loading ? '...' : 'GPS'}
        </button>
      </div>
      {gps.status && (
        <div role="status" className={`text-[10px] ${gps.status.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
          {gps.status.text}
        </div>
      )}
      {gps.needsActivation && (
        <button
          type="button"
          disabled={gps.loading}
          onClick={gps.retry}
          className="self-start rounded border border-sky-500 bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {GPS_ACTIVATE_LABEL}
        </button>
      )}
      {gps.fallbackUrl && (
        <button
          type="button"
          onClick={gps.applyAddressFallback}
          className="self-start rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:text-white"
        >
          🗺️ {GPS_ADDRESS_FALLBACK_LABEL}
        </button>
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
          className="h-11 px-4 bg-transparent text-slate-300 border border-slate-700 rounded-xl text-sm hover:text-white"
        >
          {duplicate ? 'Fechar' : 'Cancelar'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSubmit}
          className={`h-11 px-5 bg-blue-600 text-white border-none rounded-xl text-sm font-bold hover:bg-blue-500 ${
            saving ? 'opacity-70' : ''
          }`}
        >
          {saving ? 'Salvando...' : 'Adicionar Médico'}
        </button>
      </div>
    </div>
  );
}
