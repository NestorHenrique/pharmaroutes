'use client';

import { memo, useState, useEffect } from 'react';
import type { AgendaEntry, Doctor } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { STATUS_META, UNAVAILABLE_STATUSES } from '@/types/status';
import { CATEGORIAS, ESPECIALIDADES } from '@/constants';
import {
  buildWhatsAppUrl,
  isNewDoctor,
  getAgenda,
  formatAgendaBadge,
  specialtyCode,
  specialtyLabel,
  formatTime,
  minutesRemaining,
  hasSavedDraft,
  loadDraft,
  saveDraft,
  clearDraft,
  formatMinutes,
} from '@/utils';
import type { ExpectedTime } from '@/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import StatusSelector from '@/components/StatusSelector';
import AuditBadge from '@/components/AuditBadge';
import AgendaEditor from '@/components/AgendaEditor';
import ComboBox from '@/components/ComboBox';
import type { ComboOption } from '@/components/ComboBox';

/* ── Props ── */

interface DoctorCardProps {
  doc: Doctor;
  statuses: DoctorStatus[];
  categoryMode?: boolean;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
  onSetStatus: (doctorId: string, type: DoctorStatusType, opts?: { repName?: string; returnDate?: string }) => void;
  onClearStatus: (doctorId: string, type: DoctorStatusType) => void;
  /** cidades da base (grafia oficial) para o campo Cidade da edição */
  cityOptions: ComboOption[];
  /** horário esperado pela média móvel (modo "Média histórica") */
  expected?: ExpectedTime | null;
  /** modo "Ordem manual": setas para subir/descer na rota */
  onMove?: (docId: string, dir: -1 | 1) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const SPECIALTY_OPTIONS: ComboOption[] = ESPECIALIDADES.map((e) => ({
  value: e.label,
  label: e.label,
  hint: e.code,
}));

type EditForm = Partial<Doctor> & { agenda: AgendaEntry[] };

const inputCls =
  'w-full min-w-0 box-border p-1.5 rounded border border-slate-700 bg-slate-800 text-slate-100 text-[11px] outline-hidden placeholder:text-slate-500';

/** Mesmo formato para NOVO, especialidade, dias e categoria */
const tagCls = 'text-[9px] px-1 py-px rounded-sm font-bold whitespace-nowrap';

/* ── Component ── */

function DoctorCard({
  doc,
  statuses,
  categoryMode,
  onUpdateDoctor,
  onDeleteDoctor,
  onSetStatus,
  onClearStatus,
  cityOptions,
  expected,
  onMove,
  isFirst,
  isLast,
}: DoctorCardProps) {
  const draftKey = `edit_${doc.id}`;
  const hasDraft = hasSavedDraft(draftKey);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ agenda: [] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const gps = useGeolocation();

  const isNew = isNewDoctor(doc);
  const agenda = getAgenda(doc);
  const specCode = specialtyCode(doc.especialidade);
  const whatsAppUrl = buildWhatsAppUrl(doc.telefone);

  /* ── Status derivados ── */
  const has = (t: DoctorStatusType) => statuses.some((s) => s.status_type === t);
  const visited = statuses.find((s) => s.status_type === 'visitado_hoje');
  const isAbsent = statuses.some((s) => UNAVAILABLE_STATUSES.includes(s.status_type));

  let highlightCls = 'border-slate-800 bg-slate-900';
  if (has('ultimo_paciente')) highlightCls = 'border-red-500 bg-red-950/40 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]';
  else if (has('representante_no_consultorio')) highlightCls = 'border-emerald-500 bg-emerald-950/30';
  else if (visited) highlightCls = 'border-emerald-500 bg-emerald-950/40';
  else if (has('aguardando_medico')) highlightCls = 'border-sky-500 bg-sky-950/30';
  else if (has('nao_veio_hoje') || has('finalizou_atendimento')) highlightCls = 'border-slate-600 bg-slate-900';
  else if (has('ferias') || has('viajando')) highlightCls = 'border-amber-500 bg-slate-900';

  /* ── Rascunho da edição ── */
  useEffect(() => {
    if (!isEditing) return;
    const timer = setTimeout(() => saveDraft(draftKey, editForm), 500);
    return () => clearTimeout(timer);
  }, [isEditing, editForm, draftKey]);

  const setField = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const handleStartEdit = () => {
    setFormError(null);
    const draft = loadDraft<Partial<EditForm>>(draftKey);
    const base: EditForm = {
      agenda: getAgenda(doc),
      especialidade: doc.especialidade || '',
      complemento: doc.complemento || '',
      endereco: doc.endereco || '',
      numero: doc.numero || '',
      bairro: doc.bairro || '',
      cidade: doc.cidade || '',
      observacoes: doc.observacoes || '',
      telefone: doc.telefone || '',
      email: doc.email || '',
      map_link: doc.map_link || '',
      categoria: doc.categoria || 'consultorio',
    };
    // Rascunhos antigos (sem agenda) caem no valor atual do médico
    setEditForm(draft ? { ...base, ...draft, agenda: draft.agenda ?? base.agenda } : base);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    clearDraft(draftKey);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload: Partial<Doctor> = {
        agenda: editForm.agenda,
        especialidade: (editForm.especialidade || '').trim() || null,
        complemento: editForm.complemento ?? '',
        endereco: editForm.endereco ?? '',
        numero: editForm.numero ?? '',
        bairro: editForm.bairro ?? '',
        cidade: (editForm.cidade ?? '').trim(),
        observacoes: editForm.observacoes ?? '',
        telefone: editForm.telefone ?? '',
        email: editForm.email ?? '',
        map_link: editForm.map_link ?? '',
        categoria: editForm.categoria,
      };
      const ok = await onUpdateDoctor(doc.id, payload, doc.descricao || '');
      if (ok) {
        clearDraft(draftKey);
        setIsEditing(false);
      } else {
        setFormError('Não foi possível salvar. Tente novamente.');
      }
    } catch {
      setFormError('Erro de conexão ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const openNavigation = () => {
    const link = doc.map_link?.trim();
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!doc.endereco) return;
    const address = [[doc.endereco, doc.numero || 'SN'].join(', '), doc.bairro, doc.cidade]
      .filter(Boolean)
      .join(', ');
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const canNavigate = Boolean(doc.map_link?.trim() || doc.endereco);

  /* ── Render ── */

  return (
    <div
      className={`border rounded-lg px-3.5 py-3 flex flex-col gap-2 transition-colors ${highlightCls} ${
        isNew ? 'border-l-[3px] border-l-green-500' : ''
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      {/* ── Faixas de status ── */}
      {statuses.map((s) => {
        const meta = STATUS_META[s.status_type];
        const remaining = minutesRemaining(s.expires_at);
        const isVisit = s.status_type === 'visitado_hoje';
        const showTime = meta.showTime;
        return (
          <div
            key={s.status_type}
            className={`rounded-md px-2.5 py-1.5 text-[11px] flex items-center justify-between border border-white/10 ${meta.bg} ${meta.text}`}
          >
            <span>
              {meta.emoji} <strong>{isVisit ? 'Visitado' : meta.label}</strong>
              {showTime && <span className="text-slate-300"> — às {formatTime(s.created_at)}</span>}
              {isVisit && s.rep_name && <span className="text-slate-400"> · {s.rep_name}</span>}
              {meta.duration !== null && remaining !== null && remaining > 0 && (
                <span className="text-slate-500"> · {remaining}min restante</span>
              )}
              {s.return_date && (
                <span className="text-slate-400">
                  {' '}
                  · Retorno: {new Date(s.return_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              )}
            </span>
          </div>
        );
      })}

      {/* ── Cabeçalho ── */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="m-0 text-sm font-semibold text-white uppercase break-words">{doc.descricao}</h3>
            {/* OCR — preparação visual: 🟢 confirmado · 🟡 encaixe/alterado · 🔴 ausente */}
            {doc.ocr_status && (
              <span
                title={
                  doc.ocr_status === 'confirmado'
                    ? 'Confirmado'
                    : doc.ocr_status === 'encaixe'
                      ? 'Encaixe / Alterado'
                      : 'Ausente'
                }
                className={`size-2.5 rounded-full shrink-0 ${
                  doc.ocr_status === 'confirmado'
                    ? 'bg-green-500'
                    : doc.ocr_status === 'encaixe'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              />
            )}
          </div>

          {/* Tags: especialidade · NOVO · visitado · local · dias (turno) */}
          <div className="flex gap-1 items-center mt-1 flex-wrap">
            {specCode && (
              <span
                title={doc.especialidade || specialtyLabel(specCode)}
                className={`${tagCls} text-[10px] bg-rose-900 text-rose-200 ring-1 ring-rose-500/40`}
              >
                {specCode}
              </span>
            )}
            {expected && (
              <span
                title={
                  expected.sameWeekday
                    ? `Média dos últimos ${expected.samples} registro(s) neste dia da semana`
                    : `Média de ${expected.samples} registro(s) na última semana`
                }
                className={`${tagCls} bg-sky-900 text-sky-200`}
              >
                ⏱ ~{formatMinutes(expected.minutes)}
              </span>
            )}
            {isNew && <span className={`${tagCls} bg-green-900 text-green-400`}>NOVO</span>}
            {visited && <span className={`${tagCls} bg-emerald-600 text-white`}>✅ VISITADO</span>}
            {doc.categoria && doc.categoria !== 'consultorio' && (
              <span className={`${tagCls} bg-purple-900 text-purple-300`}>{doc.categoria.toUpperCase()}</span>
            )}
            {agenda.map((e) => (
              <span key={e.day} className={`${tagCls} bg-blue-900 text-blue-300`}>
                {formatAgendaBadge(e)}
              </span>
            ))}
          </div>

          {(doc.crm || doc.especialidade) && (
            <div className="text-[11px] text-slate-500 mt-1">
              {doc.crm && (
                <span>
                  CRM {doc.crm.toUpperCase()}
                  {doc.uf ? `/${doc.uf.toUpperCase()}` : ''}
                </span>
              )}
              {doc.crm && doc.especialidade && <span> · </span>}
              {doc.especialidade && <span>{doc.especialidade}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onMove && !isEditing && (
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Subir na rota"
                disabled={isFirst}
                onClick={() => onMove(doc.id, -1)}
                className="rounded-t border border-slate-700 bg-slate-800 px-1.5 text-[10px] leading-4 text-slate-300 hover:text-white disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Descer na rota"
                disabled={isLast}
                onClick={() => onMove(doc.id, 1)}
                className="rounded-b border border-t-0 border-slate-700 bg-slate-800 px-1.5 text-[10px] leading-4 text-slate-300 hover:text-white disabled:opacity-30"
              >
                ▼
              </button>
            </div>
          )}
          <StatusSelector doctorId={doc.id} statuses={statuses} onSet={onSetStatus} onClear={onClearStatus} />

          {!isEditing && (
            <div className="flex gap-1.5 opacity-70">
              <button
                onClick={handleStartEdit}
                className={`bg-transparent border-none text-[11px] px-1 py-0.5 hover:text-white ${
                  hasDraft ? 'text-amber-400' : 'text-slate-400'
                }`}
                title={hasDraft ? 'Rascunho salvo — clique para continuar' : 'Editar'}
              >
                {hasDraft ? '✏️ Rascunho' : 'Editar'}
              </button>
              <button
                onClick={() => onDeleteDoctor(doc)}
                className="bg-transparent border-none text-red-400 text-[11px] px-1 py-0.5 hover:text-red-300"
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PSM/SAMU/Hospital: marcar visitado ── */}
      {categoryMode && !isEditing && (
        <div className="flex items-center gap-2">
          {visited ? (
            <button
              onClick={() => onClearStatus(doc.id, 'visitado_hoje')}
              className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold"
            >
              ✅ Visitado — desfazer
            </button>
          ) : (
            <button
              onClick={() => onSetStatus(doc.id, 'visitado_hoje')}
              className="text-[10px] px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-white hover:border-emerald-500"
            >
              Marcar como Visitado
            </button>
          )}
        </div>
      )}

      {/* ── Edição / Visualização ── */}
      {isEditing ? (
        <div className="bg-slate-950 p-2.5 rounded-md border border-slate-800 flex flex-col gap-2">
          <AgendaEditor value={editForm.agenda} onChange={(a) => setField('agenda', a)} />

          <div className="grid grid-cols-[1fr_auto] gap-1.5 items-center">
            <ComboBox
              size="sm"
              value={editForm.especialidade ?? ''}
              onChange={(v) => setField('especialidade', v)}
              options={SPECIALTY_OPTIONS}
              placeholder="Especialidade"
            />
            <span className={`${tagCls} text-[10px] bg-rose-900 text-rose-200 min-w-8 text-center`}>
              {specialtyCode(editForm.especialidade) ?? '—'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <input type="tel" placeholder="Telefone" value={editForm.telefone ?? ''} onChange={(e) => setField('telefone', e.target.value)} className={inputCls} />
            <input type="text" placeholder="Clínica / Local (PSM, SAMU, Hospital...)" value={editForm.complemento ?? ''} onChange={(e) => setField('complemento', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-1.5">
            <input type="text" placeholder="Endereço" value={editForm.endereco ?? ''} onChange={(e) => setField('endereco', e.target.value)} className={inputCls} />
            <input type="text" placeholder="Número" value={editForm.numero ?? ''} onChange={(e) => setField('numero', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <input type="text" placeholder="Bairro" value={editForm.bairro ?? ''} onChange={(e) => setField('bairro', e.target.value)} className={inputCls} />
            <ComboBox
              size="sm"
              value={editForm.cidade ?? ''}
              onChange={(v) => setField('cidade', v)}
              options={cityOptions}
              placeholder="Cidade"
            />
          </div>

          <div className="flex gap-1.5">
            <input type="text" placeholder="Link GPS Maps" value={editForm.map_link ?? ''} onChange={(e) => setField('map_link', e.target.value)} className={`${inputCls} flex-1`} />
            <button
              type="button"
              disabled={gps.loading}
              onClick={() => gps.capture((url) => setField('map_link', url))}
              className="bg-green-700 text-white border-none px-2 rounded text-[10px] font-semibold shrink-0 hover:bg-green-600 disabled:opacity-50"
            >
              {gps.loading ? '...' : 'GPS'}
            </button>
          </div>
          {gps.status && (
            <div role="status" className={`text-[10px] ${gps.status.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {gps.status.text}
            </div>
          )}

          <input type="text" placeholder="Observações do Propagandista" value={editForm.observacoes ?? ''} onChange={(e) => setField('observacoes', e.target.value)} className={inputCls} />

          <div>
            <span className="text-[10px] text-slate-500 block mb-[3px]">Categoria do Local:</span>
            <select
              value={editForm.categoria ?? 'consultorio'}
              onChange={(e) => setField('categoria', e.target.value as Doctor['categoria'])}
              className={inputCls}
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {formError && <div role="alert" className="text-[11px] text-red-400">{formError}</div>}

          <div className="flex gap-1.5 justify-end mt-0.5">
            <button type="button" onClick={handleCancelEdit} className="px-2.5 py-1 bg-slate-700 text-slate-300 border-none rounded text-[11px] hover:bg-slate-600">
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className={`px-2.5 py-1 bg-blue-600 text-white border-none rounded text-[11px] font-semibold hover:bg-blue-500 ${saving ? 'opacity-70' : ''}`}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-300 flex flex-col gap-0.5">
          <div className="text-sky-400 font-semibold text-[11px] uppercase">
            {doc.complemento ? doc.complemento : 'Consultório Próprio'}
          </div>
          <div className="text-slate-400 text-xs">
            {doc.endereco}
            {doc.numero && `, ${doc.numero}`}
            {doc.bairro && <span className="text-slate-300 font-medium"> — {doc.bairro.toUpperCase()}</span>}
            {doc.cidade && <span className="text-blue-400 font-semibold"> • {doc.cidade.toUpperCase()}</span>}
          </div>
        </div>
      )}

      {/* ── Observações ── */}
      {!isEditing && doc.observacoes && (
        <div className="border-l-2 border-amber-500 pl-2 text-[11px] text-amber-400 italic mt-0.5">
          <strong className="not-italic">OBS:</strong> {doc.observacoes}
        </div>
      )}

      {/* ── Rodapé ── */}
      {!isEditing && (
        <div className="flex justify-between items-center pt-1.5 border-t border-slate-800 gap-2 mt-0.5 flex-wrap">
          <div>
            {(doc.updated_at || doc.updated_by_name) && (
              <AuditBadge updatedAt={doc.updated_at} updatedByName={doc.updated_by_name} />
            )}
          </div>

          <div className="flex gap-1 ml-auto">
            <button
              onClick={openNavigation}
              disabled={!canNavigate}
              className={`px-[9px] py-1 text-white border-none rounded text-[11px] font-semibold ${
                canNavigate ? 'opacity-100' : 'cursor-not-allowed opacity-40'
              } ${doc.map_link ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-900 hover:bg-blue-800'}`}
            >
              {doc.map_link ? 'GPS Fixo' : 'GPS'}
            </button>

            {whatsAppUrl && (
              <button
                onClick={() => window.open(whatsAppUrl, '_blank', 'noopener,noreferrer')}
                className="px-[9px] py-1 bg-green-700 text-white border-none rounded text-[11px] font-semibold hover:bg-green-600"
              >
                WhatsApp
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DoctorCard);
