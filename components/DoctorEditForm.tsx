'use client';

import { useEffect, useState } from 'react';
import type { AgendaEntry, Doctor } from '@/types/doctor';
import { CYCLE_WEEKS, cycleWeekLabel, normalizeCycleWeeks } from '@/types/doctor';
import { CATEGORIAS } from '@/constants';
import { SPECIALTY_LIST, clearDraft, getAgenda, loadDraft, normalizeCrm, saveDraft, specialtyCode, whatsappDigits } from '@/utils';
import WhatsAppFields, { whatsappFormError } from '@/components/WhatsAppFields';
import { useGeolocation, GPS_ACTIVATE_LABEL, GPS_ADDRESS_FALLBACK_LABEL } from '@/hooks/useGeolocation';
import { mergeAddress } from '@/lib/geocode';
import AgendaEditor from '@/components/AgendaEditor';
import ComboBox from '@/components/ComboBox';
import FormTitle from '@/components/FormTitle';
import type { ComboOption } from '@/components/ComboBox';

/* ── Edição do médico dentro da ficha (mesmo visual da ficha de status) ── */

interface DoctorEditFormProps {
  doc: Doctor;
  cityOptions: ComboOption[];
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  /** volta para a ficha de status (salvou ou cancelou) */
  onDone: () => void;
}

type EditForm = Partial<Doctor> & { agenda: AgendaEntry[] };

const SPECIALTY_OPTIONS: ComboOption[] = SPECIALTY_LIST;

const inputCls =
  'w-full min-w-0 box-border h-11 px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base sm:text-sm outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';
const cardCls = 'rounded-2xl border border-slate-800 bg-slate-950 p-4 flex flex-col gap-3';

function initialForm(doc: Doctor): EditForm {
  return {
    descricao: doc.descricao || '',
    crm: doc.crm || '',
    uf: doc.uf || 'PI',
    agenda: getAgenda(doc),
    especialidade: doc.especialidade || '',
    complemento: doc.complemento || '',
    endereco: doc.endereco || '',
    numero: doc.numero || '',
    bairro: doc.bairro || '',
    cidade: doc.cidade || '',
    observacoes: doc.observacoes || '',
    telefone: doc.telefone || '',
    whatsapp_medico: whatsappDigits(doc.whatsapp_medico),
    whatsapp_clinica: whatsappDigits(doc.whatsapp_clinica),
    email: doc.email || '',
    map_link: doc.map_link || '',
    categoria: doc.categoria || 'consultorio',
    cycle_weeks: normalizeCycleWeeks(doc.cycle_weeks),
  };
}

export default function DoctorEditForm({ doc, cityOptions, onUpdateDoctor, onDone }: DoctorEditFormProps) {
  const draftKey = `edit_${doc.id}`;
  const [form, setForm] = useState<EditForm>(() => {
    const base = initialForm(doc);
    const draft = loadDraft<Partial<EditForm>>(draftKey);
    // Rascunhos antigos (sem agenda) caem no valor atual do médico
    return draft ? { ...base, ...draft, agenda: draft.agenda ?? base.agenda } : base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waTouched, setWaTouched] = useState(false);
  const gps = useGeolocation();

  // Rascunho automático (não perde o que foi digitado se o app fechar)
  useEffect(() => {
    const t = setTimeout(() => saveDraft(draftKey, form), 500);
    return () => clearTimeout(t);
  }, [form, draftKey]);

  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) => setForm((p) => ({ ...p, [key]: value }));

  const cancel = () => {
    clearDraft(draftKey);
    onDone();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const nome = (form.descricao || '').trim().toUpperCase();
    if (!nome) {
      setSaving(false);
      setError('O nome do médico não pode ficar vazio.');
      return;
    }
    const waError = whatsappFormError(form.whatsapp_medico, form.whatsapp_clinica, {
      medico: whatsappDigits(doc.whatsapp_medico),
      clinica: whatsappDigits(doc.whatsapp_clinica),
    });
    if (waError) {
      setSaving(false);
      setWaTouched(true);
      setError(waError);
      return;
    }
    try {
      const payload: Partial<Doctor> = {
        agenda: form.agenda,
        especialidade: (form.especialidade || '').trim() || null,
        complemento: form.complemento ?? '',
        endereco: form.endereco ?? '',
        numero: form.numero ?? '',
        bairro: form.bairro ?? '',
        cidade: (form.cidade ?? '').trim(),
        observacoes: form.observacoes ?? '',
        telefone: form.telefone ?? '',
        email: form.email ?? '',
        map_link: form.map_link ?? '',
        categoria: form.categoria,
      };
      // Nome, CRM e UF só vão se mudaram
      if (nome !== (doc.descricao || '')) payload.descricao = nome;
      const crm = normalizeCrm(form.crm);
      if (crm !== normalizeCrm(doc.crm)) payload.crm = crm;
      const uf = (form.uf || '').trim().toUpperCase() || 'PI';
      if (uf !== (doc.uf || 'PI')) payload.uf = uf;
      const weeks = normalizeCycleWeeks(form.cycle_weeks);
      if (weeks.join(',') !== normalizeCycleWeeks(doc.cycle_weeks).join(',')) payload.cycle_weeks = weeks;
      // WhatsApps só vão se mudaram (não quebra a edição antes da migração v7)
      const wm = (form.whatsapp_medico || '').replace(/\D/g, '');
      if (wm !== whatsappDigits(doc.whatsapp_medico)) payload.whatsapp_medico = wm || null;
      const wc = (form.whatsapp_clinica || '').replace(/\D/g, '');
      if (wc !== whatsappDigits(doc.whatsapp_clinica)) payload.whatsapp_clinica = wc || null;
      const ok = await onUpdateDoctor(doc.id, payload, doc.descricao || '');
      if (ok) {
        clearDraft(draftKey);
        onDone();
      } else {
        setError('Não foi possível salvar. Tente novamente.');
      }
    } catch {
      setError('Erro de conexão ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const weeks = form.cycle_weeks ?? [];
  const specCode = specialtyCode(form.especialidade);

  return (
    <div className="flex flex-col gap-4">
      {/* Identificação: nome, CRM e UF */}
      <section className={cardCls}>
        <FormTitle>Identificação</FormTitle>
        <input
          type="text"
          placeholder="Nome do médico"
          aria-label="Nome do médico"
          value={form.descricao ?? ''}
          onChange={(e) => set('descricao', e.target.value.toUpperCase())}
          className={inputCls}
        />
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="CRM"
            aria-label="CRM"
            value={form.crm ?? ''}
            onChange={(e) => set('crm', e.target.value)}
            className={inputCls}
          />
          <input
            type="text"
            placeholder="UF"
            aria-label="UF"
            maxLength={2}
            value={form.uf ?? ''}
            onChange={(e) => set('uf', e.target.value.toUpperCase())}
            className={`${inputCls} uppercase`}
          />
        </div>
      </section>

      {/* Agenda + semanas */}
      <section className={cardCls}>
        <AgendaEditor value={form.agenda} onChange={(a) => set('agenda', a)} />
        <div className="flex flex-col gap-2">
          <FormTitle>Semanas do ciclo</FormTitle>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Semanas do ciclo">
            {CYCLE_WEEKS.map((w) => {
              const on = weeks.includes(w);
              return (
                <button
                  key={w}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('cycle_weeks', normalizeCycleWeeks(on ? weeks.filter((x) => x !== w) : [...weeks, w]))}
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
      </section>

      {/* Especialidade e categoria */}
      <section className={cardCls}>
        <FormTitle>Especialidade e local</FormTitle>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <ComboBox
            value={form.especialidade ?? ''}
            onChange={(v) => set('especialidade', v)}
            options={SPECIALTY_OPTIONS}
            placeholder="Especialidade"
          />
          <span className="h-11 min-w-12 px-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center">
            {specCode ?? '—'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Categoria do local">
          {CATEGORIAS.map((c) => {
            const on = (form.categoria ?? 'consultorio') === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => set('categoria', c.value as Doctor['categoria'])}
                className={`h-10 rounded-xl text-sm ${
                  on ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Clínica / local (PSM, SAMU, hospital...)"
          value={form.complemento ?? ''}
          onChange={(e) => set('complemento', e.target.value)}
          className={inputCls}
        />
      </section>

      {/* Endereço e GPS */}
      <section className={cardCls}>
        <FormTitle>Endereço</FormTitle>
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <input type="text" placeholder="Rua / avenida" value={form.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} className={inputCls} />
          <input type="text" placeholder="Número" value={form.numero ?? ''} onChange={(e) => set('numero', e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="text" placeholder="Bairro" value={form.bairro ?? ''} onChange={(e) => set('bairro', e.target.value)} className={inputCls} />
          <ComboBox value={form.cidade ?? ''} onChange={(v) => set('cidade', v)} options={cityOptions} placeholder="Cidade" />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Link do Google Maps"
            value={form.map_link ?? ''}
            onChange={(e) => set('map_link', e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            disabled={gps.loading}
            onClick={() =>
              gps.capture((url) => set('map_link', url), {
                fallbackAddress: [[form.endereco, form.numero].filter(Boolean).join(', '), form.bairro, form.cidade]
                  .filter(Boolean)
                  .join(', '),
                // Toque no GPS também busca endereço, bairro e cidade do ponto atual
                onAddress: (a) => setForm((p) => mergeAddress(p, a)),
              })
            }
            className="h-11 px-4 shrink-0 rounded-xl border-0 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {gps.loading ? '...' : 'GPS'}
          </button>
        </div>
        {gps.status && (
          <div role="status" className={`text-sm ${gps.status.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {gps.status.text}
          </div>
        )}
        {(gps.needsActivation || gps.fallbackUrl) && (
          <div className="flex gap-2 flex-wrap">
            {gps.needsActivation && (
              <button
                type="button"
                disabled={gps.loading}
                onClick={gps.retry}
                className="h-10 px-4 rounded-xl border border-blue-600 bg-transparent text-sm font-semibold text-blue-400 disabled:opacity-50"
              >
                {GPS_ACTIVATE_LABEL}
              </button>
            )}
            {gps.fallbackUrl && (
              <button
                type="button"
                onClick={gps.applyAddressFallback}
                className="h-10 px-4 rounded-xl border border-slate-700 bg-transparent text-sm text-slate-200"
              >
                {GPS_ADDRESS_FALLBACK_LABEL}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Contato e observação */}
      <section className={cardCls}>
        <FormTitle>Contato e observação</FormTitle>
        <WhatsAppFields
          medico={form.whatsapp_medico ?? ''}
          clinica={form.whatsapp_clinica ?? ''}
          onChange={(k, v) => set(k, v)}
          showErrors={waTouched}
          inputCls={inputCls}
        />
        <textarea
          placeholder="Observações do propagandista"
          value={form.observacoes ?? ''}
          onChange={(e) => set('observacoes', e.target.value)}
          rows={3}
          className="w-full min-w-0 box-border px-3.5 py-3 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base sm:text-sm outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600 resize-none"
        />
      </section>

      {error && (
        <div role="alert" className="text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={cancel}
          className="h-[52px] rounded-2xl border border-slate-700 bg-slate-800 text-slate-100 text-sm font-semibold"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="h-[52px] rounded-2xl border-0 bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
