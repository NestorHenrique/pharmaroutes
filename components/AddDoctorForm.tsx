'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AddDoctorResult, AgendaEntry, Doctor } from '@/types/doctor';
import { CYCLE_WEEKS, cycleWeekLabel, normalizeCycleWeeks } from '@/types/doctor';
import { CATEGORIAS } from '@/constants';
import { SPECIALTY_LIST, formatAgendaBadge, formatCrm, getAgenda, normalizeCrm, sortAgenda, specialtyCode } from '@/utils';
import WhatsAppFields, { whatsappFormError } from '@/components/WhatsAppFields';
import { lookupCrm } from '@/lib/crmLookup';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useGeolocation, GPS_ACTIVATE_LABEL, GPS_ADDRESS_FALLBACK_LABEL } from '@/hooks/useGeolocation';
import { mergeAddress } from '@/lib/geocode';
import AgendaEditor from '@/components/AgendaEditor';
import ComboBox from '@/components/ComboBox';
import FormTitle from '@/components/FormTitle';
import type { ComboOption } from '@/components/ComboBox';

const SPECIALTY_OPTIONS: ComboOption[] = SPECIALTY_LIST;

/* ── Types ── */

interface AddDoctorFormProps {
  onAdd: (data: Partial<Doctor>) => Promise<AddDoctorResult>;
  /** médico que já está na base: volta ao meu painel (se eu tinha excluído) e guarda as MINHAS semanas do ciclo */
  onAddToPanel: (doc: Doctor, weeks: number[]) => Promise<boolean>;
  /** o médico está fora do meu painel (eu o excluí)? */
  isHidden: (doctorId: string) => boolean;
  /** minhas semanas do ciclo para esse médico */
  currentWeeks: (doctorId: string) => number[];
  onCancel: () => void;
  /** cidades da base (grafia oficial) */
  cityOptions: ComboOption[];
  /** CRM + UF já cadastrado? Usado antes da busca, para não buscar quem já está na base */
  findDuplicate?: (crm: string, uf: string) => Doctor | undefined;
  /** dentro de uma folha (BottomSheet): sem moldura própria */
  embedded?: boolean;
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
  'w-full min-w-0 box-border h-[52px] px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base sm:text-sm outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';

/* ── Component ── */

export default function AddDoctorForm({ onAdd, onAddToPanel, isHidden, currentWeeks, onCancel, cityOptions, findDuplicate, embedded = false }: AddDoctorFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waTouched, setWaTouched] = useState(false);
  /** médico que JÁ está na base (achado pelo CRM + UF) */
  const [existing, setExisting] = useState<Doctor | null>(null);
  /** a base foi consultada para este CRM e ele não existe */
  const [crmIsNew, setCrmIsNew] = useState(false);
  const [existingWeeks, setExistingWeeks] = useState<number[]>([]);
  /** médico cujas semanas já foram carregadas (a lista recarregando no fundo não zera o que está sendo escolhido) */
  const weeksLoadedFor = useRef<string | null>(null);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const gps = useGeolocation();

  const { clearSaved, restored } = useFormPersistence('add_doctor', form, setForm, DEFAULTS);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (key === 'crm' || key === 'uf') {
        setExisting(null);
        setCrmIsNew(false);
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
    const waError = whatsappFormError(form.whatsapp_medico, form.whatsapp_clinica);
    if (waError) {
      setWaTouched(true);
      setError(waError);
      return;
    }
    setSaving(true);
    setError(null);
    setExisting(null);
    setLinkMsg(null);

    const payload: Partial<Doctor> = {
      descricao: form.descricao.trim(),
      crm: normalizeCrm(form.crm),
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
    const wm = form.whatsapp_medico.replace(/\D/g, '');
    const wc = form.whatsapp_clinica.replace(/\D/g, '');
    if (wm) payload.whatsapp_medico = wm;
    if (wc) payload.whatsapp_clinica = wc;

    try {
      const result = await onAdd(payload);
      if (result.ok) {
        clearSaved();
        setForm(DEFAULTS);
      } else {
        setError(result.error);
        if (result.duplicate) setExisting(result.duplicate);
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
      setExisting(dup); // já está na base: mostra os dados e o botão "Adicionar ao meu painel"
      return;
    }
    setLooking(true);
    try {
      const res = await lookupCrm(form.crm, form.uf);
      if (!res.ok) {
        setLookupMsg({ type: 'error', text: res.message });
        return;
      }
      const { nome, especialidade } = res.data;
      setForm((prev) => ({
        ...prev,
        descricao: nome ? nome.toUpperCase() : prev.descricao,
        especialidade: especialidade || prev.especialidade,
      }));
      const filled = [nome && 'nome', especialidade && 'especialidade'].filter(Boolean).join(', ');
      setLookupMsg({ type: 'ok', text: `Preenchido: ${filled}. Confira antes de salvar.` });
    } finally {
      setLooking(false);
    }
  };

  // Ao digitar o CRM (e a UF), consulta a base na hora: já existe ou é novo
  useEffect(() => {
    const digits = normalizeCrm(form.crm);
    if (digits.length < 3 || form.uf.trim().length !== 2) {
      setExisting(null);
      setCrmIsNew(false);
      return;
    }
    const t = setTimeout(() => {
      const found = findDuplicate?.(form.crm, form.uf);
      setExisting(found ?? null);
      setCrmIsNew(!found);
      if (found && weeksLoadedFor.current !== found.id) {
        weeksLoadedFor.current = found.id;
        setExistingWeeks(currentWeeks(found.id));
      }
      if (!found) weeksLoadedFor.current = null;
    }, 300);
    return () => clearTimeout(t);
  }, [form.crm, form.uf, findDuplicate, currentWeeks]);

  const handleAddToPanel = async () => {
    if (!existing) return;
    setLinking(true);
    setLinkMsg(null);
    const ok = await onAddToPanel(existing, existingWeeks);
    setLinking(false);
    if (ok) {
      clearSaved();
      onCancel();
    } else {
      setLinkMsg('Não foi possível adicionar agora. Tente de novo.');
    }
  };

  const handleCancel = () => {
    clearSaved();
    onCancel();
  };

  const code = specialtyCode(form.especialidade);

  return (
    <div className={embedded ? 'flex flex-col gap-3' : 'bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3'}>
      <div className="flex justify-between items-center">
        {embedded ? <span /> : <FormTitle>Novo médico</FormTitle>}
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
      {!existing && (
      <button
        type="button"
        disabled={looking || !normalizeCrm(form.crm)}
        onClick={handleLookup}
        className="h-[52px] rounded-xl border border-dashed border-blue-800 bg-slate-950 text-sm font-semibold text-blue-300 hover:bg-blue-600/10 disabled:opacity-40"
      >
        {looking ? 'Buscando…' : 'Buscar Dados do CRM'}
      </button>
      )}
      {lookupMsg && (
        <div role="status" className={`text-[11px] ${lookupMsg.type === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
          {lookupMsg.text}
        </div>
      )}

      {crmIsNew && !existing && normalizeCrm(form.crm).length >= 3 && (
        <div role="status" className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">
          CRM novo na base. Preencha os dados do médico.
        </div>
      )}

      {existing && (
        <div className="flex flex-col gap-3">
          <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">
            Este médico já está na base
          </div>
          <dl className="m-0 flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-3.5 text-sm">
            {[
              ['Nome', existing.descricao],
              ['CRM', formatCrm(existing.crm, existing.uf)],
              ['Especialidade', existing.especialidade],
              ['Local', existing.complemento],
              ['Endereço', [[existing.endereco, existing.numero].filter(Boolean).join(', '), existing.bairro, existing.cidade].filter(Boolean).join(' · ')],
              ['Dias', getAgenda(existing).map((e) => formatAgendaBadge(e)).join(' · ')],
              ['WhatsApp médico', existing.whatsapp_medico],
              ['WhatsApp clínica', existing.whatsapp_clinica],
              ['Observações', existing.observacoes],
            ]
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => (
                <div key={k as string} className="flex flex-col gap-0.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{k}</dt>
                  <dd className="m-0 text-slate-100">{v}</dd>
                </div>
              ))}
          </dl>
          <p className="m-0 text-xs leading-snug text-slate-400">
            {isHidden(existing.id)
              ? 'Você tinha tirado este médico do seu painel. Ele volta com as semanas abaixo.'
              : 'Ele já aparece no seu painel. Você pode ajustar as semanas abaixo.'}{' '}
            Os dados são os mesmos para todos; a semana do ciclo é só sua.
          </p>
          <div>
            <div className="mb-1.5">
              <FormTitle>Semanas do ciclo (só no seu painel)</FormTitle>
            </div>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Semanas do ciclo">
              {CYCLE_WEEKS.map((w) => {
                const on = existingWeeks.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setExistingWeeks((cur) => normalizeCycleWeeks(on ? cur.filter((x) => x !== w) : [...cur, w]))}
                    className={`h-11 rounded-xl text-sm font-semibold ${on ? 'border border-blue-600 bg-blue-900 font-bold text-blue-200' : 'border border-slate-700 bg-slate-950 text-slate-400'}`}
                  >
                    {cycleWeekLabel(w)}
                  </button>
                );
              })}
            </div>
          </div>
          {linkMsg && <div role="alert" className="text-xs text-red-400">{linkMsg}</div>}
        </div>
      )}

      {!existing && (
        <>
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
                  on ? 'border border-blue-600 bg-blue-900 font-semibold text-blue-200' : 'border border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                {c.label}
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
                  on ? 'border border-blue-600 bg-blue-900 font-bold text-blue-200' : 'border border-slate-700 bg-slate-950 text-slate-400'
                }`}
              >
                {cycleWeekLabel(w)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Endereço + Número */}
      <FormTitle>Endereço</FormTitle>
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
      <WhatsAppFields
        medico={form.whatsapp_medico}
        clinica={form.whatsapp_clinica}
        onChange={(k, v) => setField(k, v)}
        showErrors={waTouched}
        inputCls={inputCls}
      />

      {/* Email */}
      <div className="grid grid-cols-1 gap-1.5">
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

        </>
      )}

      {!existing && error && <div role="alert" className="text-[11px] text-red-400">{error}</div>}

      {/* Botões */}
      <div className="mt-1 grid grid-cols-[1fr_2fr] gap-2.5">
        <button
          type="button"
          onClick={handleCancel}
          className="h-[52px] px-4 bg-slate-950 text-slate-100 border border-slate-700 rounded-[14px] text-base font-semibold"
        >
          {existing ? 'Fechar' : 'Cancelar'}
        </button>
        {existing ? (
          <button
            type="button"
            disabled={linking}
            onClick={() => void handleAddToPanel()}
            className={`h-[52px] px-5 bg-blue-600 text-white border-none rounded-[14px] text-base font-bold hover:bg-blue-500 ${linking ? 'opacity-70' : ''}`}
          >
            {linking ? 'Adicionando…' : isHidden(existing.id) ? 'Adicionar ao meu painel' : 'Salvar semanas'}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className={`h-[52px] px-5 bg-blue-600 text-white border-none rounded-[14px] text-base font-bold hover:bg-blue-500 ${
              saving ? 'opacity-70' : ''
            }`}
          >
            {saving ? 'Salvando...' : 'Adicionar Médico'}
          </button>
        )}
      </div>
    </div>
  );
}
