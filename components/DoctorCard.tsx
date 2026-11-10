'use client';

import { memo, useState, useEffect } from 'react';
import type { AgendaEntry, Doctor, ExpectedVisit, RouteTier } from '@/types/doctor';
import { CYCLE_WEEKS, TOP_PRIORITY_STATUSES, cycleWeekLabel, normalizeCycleWeeks } from '@/types/doctor';
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
  formatElapsed,
  formatVisitAudit,
  minutesRemaining,
  hasSavedDraft,
  loadDraft,
  saveDraft,
  clearDraft,
  formatMinutes,
} from '@/utils';
import { useGeolocation, GPS_ACTIVATE_LABEL, GPS_ADDRESS_FALLBACK_LABEL } from '@/hooks/useGeolocation';
import { mergeAddress } from '@/lib/geocode';
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
  expected?: ExpectedVisit | null;
  /** bloco do feed: top (ativo) · middle (rota) · bottom (indisponível, esmaecido) */
  tier?: RouteTier;
  /** alça de arraste por toque (iOS/Android/PWA) */
  onDragHandleTouchStart?: (docId: string, clientY: number) => void;
  /** ciclo de 5 semanas: quando este representante marcou visitado (null = pendente) */
  cycleVisitedAt?: string | null;
  /** marca/desfaz a visita do ciclo; ausente = botão oculto */
  onToggleCycleVisit?: (docId: string, visited: boolean) => void;
  /** semana ativa ("Estou visitando na"): o visitado entra nela automaticamente */
  activeWeekLabel?: string | null;
  /** card aberto (ficha completa); fechado = linha compacta de 2 linhas */
  expanded?: boolean;
  /** abre/fecha o card; ausente = sempre aberto */
  onToggleExpand?: (docId: string) => void;
  /** abre direto no modo edição (menu ⋯ › Editar da ficha) */
  autoEdit?: boolean;
  /** avisado ao salvar ou cancelar a edição */
  onEditEnd?: () => void;
  /** relógio da tela (ms): faz o "há X min" dos cards em atendimento crescer sozinho */
  now?: number;
}

const SPECIALTY_OPTIONS: ComboOption[] = ESPECIALIDADES.map((e) => ({
  value: e.label,
  label: e.label,
  hint: e.code,
}));

type EditForm = Partial<Doctor> & { agenda: AgendaEntry[] };

const inputCls =
  'w-full min-w-0 box-border h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base sm:text-sm outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';

/** Mesmo formato para NOVO, especialidade, dias e categoria */
const tagCls = 'text-[9px] px-1 py-px rounded-sm font-bold whitespace-nowrap uppercase';

/**
 * Abre Maps/WhatsApp fora do app sem trocar a página do PWA.
 * Um <a target="_blank"> clicado no próprio toque é o caminho mais estável no iOS standalone:
 * o iOS entrega o link ao app do Google Maps/WhatsApp (ou ao Safari) e o PWA continua intacto.
 * Nunca usar window.location.href aqui: isso descarrega o app e volta em tela branca.
 */
function openExternal(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

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
  tier = 'middle',
  onDragHandleTouchStart,
  cycleVisitedAt = null,
  onToggleCycleVisit,
  activeWeekLabel = null,
  expanded = true,
  onToggleExpand,
  autoEdit = false,
  onEditEnd,
  now,
}: DoctorCardProps) {
  const draftKey = `edit_${doc.id}`;
  const hasDraft = hasSavedDraft(draftKey);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ agenda: [] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const gps = useGeolocation();

  const isNew = isNewDoctor(doc);
  const agenda = getAgenda(doc);
  const specCode = specialtyCode(doc.especialidade);
  const whatsAppUrl = buildWhatsAppUrl(doc.telefone);

  /* ── Status derivados ── */
  const has = (t: DoctorStatusType) => statuses.some((s) => s.status_type === t);
  const visited = statuses.find((s) => s.status_type === 'visitado_hoje');
  const waiting = statuses.find((s) => s.status_type === 'aguardando_medico');
  const waitingLeft = waiting ? minutesRemaining(waiting.expires_at) : null;
  const muted = tier === 'bottom' || (tier !== 'top' && statuses.some((s) => UNAVAILABLE_STATUSES.includes(s.status_type)));

  let highlightCls = 'border-slate-800 bg-slate-900';
  if (muted) {
    highlightCls = has('ferias') || has('viajando') ? 'border-amber-500/60 bg-slate-900' : 'border-slate-700 bg-slate-900';
  } else if (has('ultimo_paciente')) {
    highlightCls = 'border-red-500 bg-red-950/40 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]';
  } else if (has('representante_no_consultorio')) {
    highlightCls = 'border-sky-500 bg-sky-950/40 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]';
  } else if (has('aguardando_medico')) {
    highlightCls = 'border-amber-400 bg-amber-950/30';
  } else if (visited) {
    highlightCls = 'border-emerald-500 bg-emerald-950/40';
  }

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
      cycle_weeks: normalizeCycleWeeks(doc.cycle_weeks),
    };
    // Rascunhos antigos (sem agenda) caem no valor atual do médico
    setEditForm(draft ? { ...base, ...draft, agenda: draft.agenda ?? base.agenda } : base);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    clearDraft(draftKey);
    setIsEditing(false);
    onEditEnd?.();
  };

  // Aberto pelo menu ⋯ › Editar da ficha: entra direto na edição
  useEffect(() => {
    if (autoEdit && !isEditing) handleStartEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

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
      // Semanas do ciclo: só envia se mudou (não quebra a edição antes da migração v5)
      const weeks = normalizeCycleWeeks(editForm.cycle_weeks);
      if (weeks.join(',') !== normalizeCycleWeeks(doc.cycle_weeks).join(',')) payload.cycle_weeks = weeks;
      const ok = await onUpdateDoctor(doc.id, payload, doc.descricao || '');
      if (ok) {
        clearDraft(draftKey);
        setIsEditing(false);
        onEditEnd?.();
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
      openExternal(link);
      return;
    }
    if (!doc.endereco) return;
    const address = [[doc.endereco, doc.numero || 'SN'].join(', '), doc.bairro, doc.cidade]
      .filter(Boolean)
      .join(', ');
    openExternal(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
  };

  const canNavigate = Boolean(doc.map_link?.trim() || doc.endereco);

  /* ── Linha compacta: nome + local/status, horário à direita. Toque abre a ficha. ── */
  if (onToggleExpand && !expanded && !isEditing) {
    const lead =
      statuses.find((s) => s.status_type === 'representante_no_consultorio') ??
      statuses.find((s) => s.status_type === 'ultimo_paciente') ??
      statuses.find((s) => s.status_type === 'aguardando_medico') ??
      statuses.find((s) => UNAVAILABLE_STATUSES.includes(s.status_type));
    const leadTone: Partial<Record<DoctorStatusType, { dot: string; text: string; border: string }>> = {
      representante_no_consultorio: { dot: 'bg-sky-400', text: 'text-sky-400', border: 'border-sky-500/60' },
      ultimo_paciente: { dot: 'bg-red-400', text: 'text-red-400', border: 'border-red-500/60' },
      aguardando_medico: { dot: 'bg-amber-400', text: 'text-amber-400', border: 'border-amber-400/60' },
    };
    const tone = lead ? leadTone[lead.status_type] : undefined;
    const visitedAt = cycleVisitedAt ?? (categoryMode ? visited?.created_at ?? null : null);
    /* Visita de OUTRO representante: só informa quem e quando, sem tirar o médico da rota */
    const otherVisit = !visitedAt && visited ? visited : null;
    const place = [doc.complemento || 'Consultório próprio', doc.bairro].filter(Boolean).join(' · ');
    let subline = place;
    if (tier === 'top' && lead && TOP_PRIORITY_STATUSES.includes(lead.status_type)) {
      // Em atendimento: tempo decorrido crescente
      subline = `${STATUS_META[lead.status_type].label} · ${formatElapsed(lead.created_at, now)}`;
    } else if (visitedAt) {
      subline = formatVisitAudit(visited?.rep_name, visitedAt, now);
    } else if (lead) {
      const label = STATUS_META[lead.status_type].label;
      subline = STATUS_META[lead.status_type].showTime ? `${label} · ${formatTime(lead.created_at)}` : label;
    } else if (otherVisit) {
      subline = formatVisitAudit(otherVisit.rep_name, otherVisit.created_at, now);
    }

    return (
      <div
        id={`doc-${doc.id}`}
        className={`relative rounded-2xl border px-3.5 py-3 flex items-center gap-3 transition-colors active:bg-slate-800 ${
          muted ? 'border-slate-800 bg-transparent opacity-60' : `bg-slate-900 ${tone?.border ?? 'border-slate-800'}`
        }`}
      >
        {onDragHandleTouchStart && (
          <button
            type="button"
            aria-label="Arrastar para reordenar"
            onTouchStart={(e) => onDragHandleTouchStart(doc.id, e.touches[0]?.clientY ?? 0)}
            style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
            className="relative z-10 select-none -ml-1 size-9 shrink-0 rounded-lg text-slate-500 active:bg-slate-800 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 8h14M5 12h14M5 16h14" />
            </svg>
          </button>
        )}
        {visitedAt ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-400" role="img" aria-label="Visitado">
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : tone ? (
          <span className={`size-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
        ) : null}

        <button
          type="button"
          onClick={() => onToggleExpand(doc.id)}
          aria-expanded={false}
          className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 flex flex-col gap-0.5 before:absolute before:inset-0 before:rounded-2xl before:content-['']"
        >
          <span
            className={`text-[15px] font-semibold uppercase truncate ${visitedAt ? 'text-slate-500 line-through' : 'text-white'}`}
          >
            {doc.descricao}
            {isNew && <span className="ml-1.5 align-middle text-[9px] font-bold text-green-400 no-underline">NOVO</span>}
          </span>
          <span className={`text-xs uppercase truncate ${visitedAt ? 'text-emerald-400' : tone?.text ?? 'text-slate-400'}`}>
            {subline}
          </span>
        </button>

        {expected && !visitedAt && (
          <span
            className="shrink-0 text-[13px] tabular-nums text-slate-200"
            title={`Horário médio: ${formatMinutes(expected.startMinutes)}${expected.endMinutes !== null ? ` → ${formatMinutes(expected.endMinutes)}` : ''}`}
          >
            {formatMinutes(expected.startMinutes)}
          </span>
        )}
        {cycleVisitedAt && onToggleCycleVisit ? (
          <button
            type="button"
            onClick={() => onToggleCycleVisit(doc.id, false)}
            className="relative z-10 shrink-0 h-8 px-2.5 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 hover:text-white"
          >
            Desfazer
          </button>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-600" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        )}
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div
      id={`doc-${doc.id}`}
      className={`border rounded-2xl px-3.5 py-3 flex flex-col gap-2 transition-colors ${highlightCls} ${
        isNew ? 'border-l-[3px] border-l-green-500' : ''
      } ${muted ? 'opacity-60' : ''}`}
    >
      {/* ── Timer do Aguardando Médico (30 min) ── */}
      {waiting && waitingLeft !== null && waitingLeft > 0 && !muted && (
        <div
          role="timer"
          className="self-start rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-slate-950"
        >
          ⏳ Aguardando · {waitingLeft} min restantes
        </div>
      )}

      {/* ── Faixas de status ── */}
      {statuses.map((s) => {
        const base = STATUS_META[s.status_type];
        // Cores do bloco superior alinhadas com o destaque do card
        const meta =
          s.status_type === 'representante_no_consultorio'
            ? { ...base, bg: 'bg-sky-500/10', text: 'text-sky-400' }
            : s.status_type === 'aguardando_medico'
              ? { ...base, bg: 'bg-amber-500/10', text: 'text-amber-400' }
              : base;
        const remaining = minutesRemaining(s.expires_at);
        const isVisit = s.status_type === 'visitado_hoje';
        const showTime = meta.showTime;
        return (
          <div
            key={s.status_type}
            className={`rounded-md px-2.5 py-1.5 text-[11px] flex items-center justify-between border border-white/10 ${meta.bg} ${meta.text}`}
          >
            <span>
              {isVisit ? (
                <strong>{formatVisitAudit(s.rep_name, s.created_at, now)}</strong>
              ) : TOP_PRIORITY_STATUSES.includes(s.status_type) ? (
                <>
                  <strong>{meta.label}</strong>
                  <span className="text-slate-300"> — {formatElapsed(s.created_at, now)}</span>
                </>
              ) : (
                <>
                  <strong>{meta.label}</strong>
                  {showTime && <span className="text-slate-300"> — às {formatTime(s.created_at)}</span>}
                  {meta.duration !== null && remaining !== null && remaining > 0 && (
                    <span className="text-slate-500"> · {remaining}min restante</span>
                  )}
                </>
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
            <h3 className="m-0 text-base font-semibold text-white uppercase break-words">{doc.descricao}</h3>
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
                title={`Média de todos os representantes: últimos ${expected.samples} registro(s) deste dia da semana, turno ${expected.shift.toLowerCase()}`}
                className={`${tagCls} bg-sky-900 text-sky-200`}
              >
                ⏱ ~{formatMinutes(expected.startMinutes)}
                {expected.endMinutes !== null && ` → ${formatMinutes(expected.endMinutes)}`}
              </span>
            )}
            {isNew && <span className={`${tagCls} bg-green-900 text-green-400`}>NOVO</span>}
            {visited && <span className={`${tagCls} bg-emerald-600 text-white`}>✅ VISITADO</span>}
            {normalizeCycleWeeks(doc.cycle_weeks).map((w) => (
              <span key={`w${w}`} className={`${tagCls} bg-violet-900 text-violet-200`}>
                {cycleWeekLabel(w)}
              </span>
            ))}
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
          {onDragHandleTouchStart && !isEditing && (
            <button
              type="button"
              aria-label="Arrastar para reordenar"
              onTouchStart={(e) => onDragHandleTouchStart(doc.id, e.touches[0]?.clientY ?? 0)}
              style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
              className="select-none rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm leading-none text-slate-300 active:bg-sky-700"
            >
              ☰
            </button>
          )}
          <StatusSelector doctorId={doc.id} statuses={statuses} onSet={onSetStatus} onClear={onClearStatus} />

          {!isEditing && (
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                aria-label="Mais opções"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className={`size-9 rounded-lg border bg-transparent flex items-center justify-center ${
                  hasDraft ? 'border-amber-500/60 text-amber-400' : 'border-slate-700 text-slate-300'
                } hover:text-white`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {onToggleExpand && (
                <button
                  type="button"
                  aria-label="Fechar ficha"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleExpand(doc.id);
                  }}
                  className="size-9 rounded-lg border border-slate-700 bg-transparent text-slate-300 hover:text-white flex items-center justify-center"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 15l6-6 6 6" />
                  </svg>
                </button>
              )}
              {menuOpen && (
                <div className="absolute right-0 top-11 z-10 w-44 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl shadow-black/40 flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleStartEdit();
                    }}
                    className="text-left px-3 py-2.5 rounded-lg bg-transparent text-sm text-slate-200 hover:bg-slate-800"
                  >
                    {hasDraft ? '✏️ Continuar rascunho' : 'Editar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteDoctor(doc);
                    }}
                    className="text-left px-3 py-2.5 rounded-lg bg-transparent text-sm text-red-400 hover:bg-slate-800"
                  >
                    Excluir
                  </button>
                </div>
              )}
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
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-2.5">
          <AgendaEditor value={editForm.agenda} onChange={(a) => setField('agenda', a)} />

          <div>
            <span className="text-[10px] text-slate-500 block mb-[3px]">Semanas do ciclo:</span>
            <div className="flex gap-1 flex-wrap" role="group" aria-label="Semanas do ciclo">
              {CYCLE_WEEKS.map((w) => {
                const current = editForm.cycle_weeks ?? [];
                const on = current.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setField('cycle_weeks', normalizeCycleWeeks(on ? current.filter((x) => x !== w) : [...current, w]))
                    }
                    className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                      on ? 'border-violet-500 bg-violet-500/20 text-violet-200' : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cycleWeekLabel(w)}
                  </button>
                );
              })}
            </div>
          </div>

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
              onClick={() =>
                gps.capture((url) => setField('map_link', url), {
                  fallbackAddress: [
                    [editForm.endereco, editForm.numero].filter(Boolean).join(', '),
                    editForm.bairro,
                    editForm.cidade,
                  ]
                    .filter(Boolean)
                    .join(', '),
                  onAddress: (a) => setEditForm((prev) => mergeAddress(prev, a)),
                })
              }
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
          {gps.needsActivation && (
            <button
              type="button"
              disabled={gps.loading}
              onClick={gps.retry}
              className="self-start rounded border border-sky-500 bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              📍 {GPS_ACTIVATE_LABEL}
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
            <button type="button" onClick={handleCancelEdit} className="h-10 px-4 bg-transparent text-slate-300 border border-slate-700 rounded-xl text-sm hover:text-white">
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className={`h-10 px-5 bg-blue-600 text-white border-none rounded-xl text-sm font-bold hover:bg-blue-500 ${saving ? 'opacity-70' : ''}`}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-300 flex flex-col gap-0.5">
          <div className={`${muted ? 'text-slate-500' : 'text-sky-400'} font-semibold text-[11px] uppercase`}>
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

      {/* ── Ciclo de 5 semanas: marcar visitado / desfazer ── */}
      {onToggleCycleVisit && !isEditing && (
        <div className="flex items-center gap-2 flex-wrap">
          {cycleVisitedAt ? (
            <>
              <span className="text-[11px] font-semibold text-emerald-400">
                ✓ Visitado em{' '}
                {new Date(cycleVisitedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às{' '}
                {formatTime(cycleVisitedAt)}
              </span>
              <button
                type="button"
                onClick={() => onToggleCycleVisit(doc.id, false)}
                className="text-[11px] px-2.5 py-1 rounded border border-slate-600 bg-slate-800 text-slate-200 hover:text-white"
              >
                ↩ Desfazer
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onToggleCycleVisit(doc.id, true)}
              className="text-[12px] px-3 py-1.5 rounded border border-emerald-500 bg-emerald-600 text-white font-semibold hover:bg-emerald-500"
            >
              ✓ Marcar Visitado
              {activeWeekLabel && <span className="ml-1 font-normal text-emerald-100">→ {activeWeekLabel}</span>}
            </button>
          )}
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
              disabled={!canNavigate || muted}
              className={`px-[9px] py-1 border-none rounded text-[11px] font-semibold ${
                muted
                  ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                  : `text-white ${canNavigate ? 'opacity-100' : 'cursor-not-allowed opacity-40'} ${
                      doc.map_link ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-900 hover:bg-blue-800'
                    }`
              }`}
            >
              {doc.map_link ? 'GPS Fixo' : 'GPS'}
            </button>

            {whatsAppUrl && (
              <button
                onClick={() => openExternal(whatsAppUrl)}
                disabled={muted}
                className={`px-[9px] py-1 border-none rounded text-[11px] font-semibold ${
                  muted ? 'cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-green-700 text-white hover:bg-green-600'
                }`}
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
