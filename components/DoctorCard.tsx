'use client';

import { memo, useState, useEffect } from 'react';
import type { Doctor } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { STATUS_META } from '@/types/status';
import { OPCOES_DIAS, OPCOES_TURNO, CATEGORIAS } from '@/constants';
import {
  buildWhatsAppUrl,
  isRecentDoctor,
  parseDays,
  sortDays,
  toggleDay,
  formatTime,
  minutesRemaining,
  hasSavedDraft,
  loadDraft,
  saveDraft,
  clearDraft,
} from '@/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import StatusSelector from '@/components/StatusSelector';
import AuditBadge from '@/components/AuditBadge';

/* ── Props ── */

interface DoctorCardProps {
  doc: Doctor;
  statuses: DoctorStatus[];
  categoryMode?: boolean;
  onUpdateShift: (docId: string, newTurno: string, docName: string) => void;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
  onSetStatus: (doctorId: string, type: DoctorStatusType, opts?: { repName?: string; returnDate?: string }) => void;
  onClearStatus: (doctorId: string, type: DoctorStatusType) => void;
}

const inputCls =
  'w-full min-w-0 box-border p-1.5 rounded border border-slate-700 bg-slate-800 text-slate-100 text-[11px] outline-hidden placeholder:text-slate-500';

/* ── Component ── */

function DoctorCard({
  doc,
  statuses,
  categoryMode,
  onUpdateShift,
  onUpdateDoctor,
  onDeleteDoctor,
  onSetStatus,
  onClearStatus,
}: DoctorCardProps) {
  const draftKey = `edit_${doc.id}`;
  const hasDraft = hasSavedDraft(draftKey);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Doctor>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const gps = useGeolocation();

  const currentShift = doc.turno || 'Manhã e Tarde';
  const isRecent = isRecentDoctor(doc.created_at);
  const dayTags = sortDays(parseDays(doc.dias_semana || doc.dia_semana)).map((d) => d.toUpperCase());
  const whatsAppUrl = buildWhatsAppUrl(doc.telefone);

  /* ── Status derivados ── */
  const primaryStatus = statuses.length > 0 ? statuses[0] : null;
  const statusMeta = primaryStatus ? STATUS_META[primaryStatus.status_type] : null;

  /* ── Card border class com base no status ── */
  let borderClass = 'border-slate-800';
  if (statuses.some((s) => s.status_type === 'ultimo_paciente')) borderClass = 'border-red-500';
  else if (statuses.some((s) => s.status_type === 'representante_no_consultorio')) borderClass = 'border-emerald-500';
  else if (statuses.some((s) => s.status_type === 'nao_veio_hoje')) borderClass = 'border-slate-600';
  else if (statuses.some((s) => ['ferias', 'viajando', 'saiu_do_setor'].includes(s.status_type)))
    borderClass = 'border-amber-500';

  const isAbsent = statuses.some((s) =>
    ['nao_veio_hoje', 'ferias', 'viajando', 'saiu_do_setor'].includes(s.status_type),
  );

  /* ── Form persistence para edição ── */
  useEffect(() => {
    if (!isEditing) return;
    const timer = setTimeout(() => saveDraft(draftKey, editForm), 500);
    return () => clearTimeout(timer);
  }, [isEditing, editForm, draftKey]);

  const setField = <K extends keyof Doctor>(key: K, value: Doctor[K]) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const handleStartEdit = () => {
    setFormError(null);
    const draft = loadDraft<Partial<Doctor>>(draftKey);
    if (draft) {
      setEditForm(draft);
    } else {
      setEditForm({
        dias_semana: doc.dias_semana || doc.dia_semana || '',
        complemento: doc.complemento || '',
        endereco: doc.endereco || '',
        numero: doc.numero || '',
        bairro: doc.bairro || '',
        observacoes: doc.observacoes || '',
        telefone: doc.telefone || '',
        email: doc.email || '',
        map_link: doc.map_link || '',
        categoria: doc.categoria || 'consultorio',
      });
    }
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
      const ok = await onUpdateDoctor(doc.id, editForm, doc.descricao || '');
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
      className={`bg-slate-900 border rounded-lg px-3.5 py-3 flex flex-col gap-2 transition-colors ${borderClass} ${
        isRecent ? 'border-l-[3px] border-l-green-500' : ''
      } ${isAbsent ? 'opacity-60' : ''}`}
    >
      {/* ── Status Banner ── */}
      {statuses.map((s) => {
        const meta = STATUS_META[s.status_type];
        const remaining = minutesRemaining(s.expires_at);
        return (
          <div
            key={s.status_type}
            className={`rounded-md px-2.5 py-1.5 text-[11px] flex items-center justify-between ${meta.bg} ${meta.text} border border-white/10`}
          >
            <span>
              {meta.emoji} <strong>{meta.label}</strong>
              {s.status_type === 'representante_no_consultorio' && (
                <span className="text-slate-300"> — às {formatTime(s.created_at)}</span>
              )}
              {remaining !== null && remaining > 0 && <span className="text-slate-500"> · {remaining}min restante</span>}
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="m-0 text-sm font-semibold text-white uppercase break-words">{doc.descricao}</h3>
            {isRecent && (
              <span className="text-[9px] bg-green-900 text-green-400 px-[5px] py-px rounded font-bold">NOVO</span>
            )}
            {/* OCR Status — preparação visual */}
            {doc.ocr_status && (
              <span
                title={
                  doc.ocr_status === 'confirmado'
                    ? 'Confirmado'
                    : doc.ocr_status === 'encaixe'
                      ? 'Encaixe / Alterações'
                      : 'Ausente no agenda local'
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

          <div className="flex gap-1.5 items-center mt-[3px] flex-wrap">
            {doc.crm && <span className="text-[11px] text-slate-500">CRM {doc.crm.toUpperCase()}</span>}
            {dayTags.map((tag) => (
              <span key={tag} className="text-[9px] text-blue-400 bg-blue-900 px-1 py-px rounded-sm font-bold">
                {tag}
              </span>
            ))}
            {doc.categoria && doc.categoria !== 'consultorio' && (
              <span className="text-[9px] text-purple-400 bg-purple-900 px-1 py-px rounded-sm font-bold">
                {doc.categoria.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <StatusSelector
            doctorId={doc.id}
            statuses={statuses}
            onSet={onSetStatus}
            onClear={onClearStatus}
          />

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

      {/* ── PSM/SAMU/Hospital: botão "Já Visitado" ── */}
      {categoryMode && !isEditing && (
        <div className="flex items-center gap-2">
          {statuses.some((s) => s.status_type === 'visitado_hoje') ? (
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
          <div>
            <span className="text-[10px] text-slate-500 block mb-[3px]">Dias de Atendimento:</span>
            <div className="flex gap-1">
              {OPCOES_DIAS.map((d) => {
                const isChecked = parseDays(editForm.dias_semana).includes(d.value);
                return (
                  <button
                    type="button"
                    key={d.value}
                    aria-pressed={isChecked}
                    onClick={() => setField('dias_semana', toggleDay(editForm.dias_semana, d.value))}
                    className={`flex-1 py-1 rounded border text-[10px] font-semibold ${
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

          <div className="grid grid-cols-2 gap-1.5">
            <input type="tel" placeholder="Telefone" value={editForm.telefone ?? ''} onChange={(e) => setField('telefone', e.target.value)} className={inputCls} />
            <input type="text" placeholder="Clínica / Local" value={editForm.complemento ?? ''} onChange={(e) => setField('complemento', e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-1.5">
            <input type="text" placeholder="Endereço" value={editForm.endereco ?? ''} onChange={(e) => setField('endereco', e.target.value)} className={inputCls} />
            <input type="text" placeholder="Bairro" value={editForm.bairro ?? ''} onChange={(e) => setField('bairro', e.target.value)} className={inputCls} />
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

          {/* Categoria */}
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
          <div className="flex bg-slate-950 rounded-[5px] p-0.5 border border-slate-800">
            {OPCOES_TURNO.map((opcao) => {
              const isSelected = currentShift === opcao;
              return (
                <button
                  key={opcao}
                  aria-pressed={isSelected}
                  onClick={() => onUpdateShift(doc.id, opcao, doc.descricao || '')}
                  className={`px-[7px] py-[3px] rounded-sm border-none text-[10px] ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-transparent text-slate-500 font-normal hover:text-slate-300'
                  }`}
                >
                  {opcao === 'Manhã e Tarde' ? 'Integral' : opcao}
                </button>
              );
            })}
          </div>

          <div className="flex gap-1">
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

      {/* ── Audit Badge ── */}
      {!isEditing && (doc.updated_at || doc.updated_by_name) && (
        <div className="mt-0.5">
          <AuditBadge updatedAt={doc.updated_at} updatedByName={doc.updated_by_name} />
        </div>
      )}
    </div>
  );
}

export default memo(DoctorCard);
