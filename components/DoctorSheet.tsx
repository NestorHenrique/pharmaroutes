'use client';

import { useEffect, useState } from 'react';
import type { Doctor, ExpectedVisit } from '@/types/doctor';
import { cycleWeekLabel, normalizeCycleWeeks } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { STATUS_META } from '@/types/status';
import {
  buildWhatsAppUrl,
  formatAgendaBadge,
  formatMinutes,
  formatTime,
  getAgenda,
  isNewDoctor,
  minutesRemaining,
} from '@/utils';

/* ── Ficha do médico: sobe de baixo para cima ── */

interface DoctorSheetProps {
  doc: Doctor;
  statuses: DoctorStatus[];
  expected?: ExpectedVisit | null;
  /** visitado no ciclo (rota) ou no dia (PSM/SAMU/Hospital) */
  visitedAt: string | null;
  /** semana ativa: o visitado entra nela automaticamente */
  activeWeekLabel?: string | null;
  onToggleVisited: () => void;
  onSetStatus: (doctorId: string, type: DoctorStatusType, opts?: { repName?: string; returnDate?: string }) => void;
  onClearStatus: (doctorId: string, type: DoctorStatusType) => void;
  onNavigate: (() => void) | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Status de um toque, com a cor de cada um */
const QUICK: { type: DoctorStatusType; label: string; on: string; text: string }[] = [
  { type: 'representante_no_consultorio', label: 'No consultório', on: 'border-sky-500 bg-sky-500/15', text: 'text-sky-400' },
  { type: 'ultimo_paciente', label: 'Último paciente', on: 'border-red-500 bg-red-500/15', text: 'text-red-400' },
  { type: 'aguardando_medico', label: 'Aguardando', on: 'border-amber-400 bg-amber-500/15', text: 'text-amber-400' },
  { type: 'finalizou_atendimento', label: 'Finalizou', on: 'border-slate-500 bg-slate-500/20', text: 'text-slate-200' },
  { type: 'nao_veio_hoje', label: 'Não veio hoje', on: 'border-slate-500 bg-slate-500/20', text: 'text-slate-300' },
];

const ABSENCE: { type: DoctorStatusType; label: string }[] = [
  { type: 'ferias', label: 'Licença' },
  { type: 'viajando', label: 'Viagem' },
];

const label = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortDate(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function DoctorSheet({
  doc,
  statuses,
  expected,
  visitedAt,
  activeWeekLabel,
  onToggleVisited,
  onSetStatus,
  onClearStatus,
  onNavigate,
  onEdit,
  onDelete,
  onClose,
}: DoctorSheetProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [absence, setAbsence] = useState<DoctorStatusType | null>(null);
  const [returnDate, setReturnDate] = useState('');

  // Fecha com Esc e trava o scroll da página por trás
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const has = (t: DoctorStatusType) => statuses.find((s) => s.status_type === t);
  const agenda = getAgenda(doc);
  const weeks = normalizeCycleWeeks(doc.cycle_weeks);
  const whatsAppUrl = buildWhatsAppUrl(doc.telefone);
  const address = [[doc.endereco, doc.numero].filter(Boolean).join(', '), doc.bairro, doc.cidade]
    .filter(Boolean)
    .join(' · ');

  const toggleQuick = (type: DoctorStatusType) => {
    if (has(type)) onClearStatus(doc.id, type);
    else onSetStatus(doc.id, type);
  };

  const confirmAbsence = () => {
    if (!absence || !returnDate) return;
    onSetStatus(doc.id, absence, { returnDate });
    setAbsence(null);
    setReturnDate('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 animate-[fade-in_.18s_ease-out]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${doc.descricao}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-[28px] border-t border-slate-700 bg-slate-900 px-5 pt-2.5 flex flex-col gap-4 animate-[sheet-up_.24s_cubic-bezier(.2,.8,.2,1)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
      >
        <div className="self-center h-[5px] w-10 rounded-full bg-slate-700" aria-hidden="true" />

        {/* Cabeçalho */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="m-0 text-[22px] font-bold tracking-tight text-white break-words">
              {doc.descricao}
              {isNewDoctor(doc) && <span className="ml-2 align-middle text-[10px] font-bold text-green-400">NOVO</span>}
            </h2>
            {(doc.especialidade || doc.crm) && (
              <span className="text-sm text-slate-400">
                {[doc.especialidade, doc.crm && `CRM ${doc.crm.toUpperCase()}${doc.uf ? `/${doc.uf.toUpperCase()}` : ''}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
          <div className="relative flex gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Mais opções"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="size-11 rounded-xl border border-slate-700 bg-transparent text-slate-200 flex items-center justify-center hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="size-11 rounded-xl border border-slate-700 bg-transparent text-slate-200 flex items-center justify-center hover:text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-10 w-48 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl shadow-black/40 flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="text-left px-3 py-3 rounded-lg bg-transparent text-sm text-slate-100 hover:bg-slate-800"
                >
                  Editar dados
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="text-left px-3 py-3 rounded-lg bg-transparent text-sm text-red-400 hover:bg-slate-800"
                >
                  Excluir médico
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dias, semanas */}
        {(agenda.length > 0 || weeks.length > 0) && (
          <div className="flex gap-1.5 flex-wrap">
            {agenda.map((e) => (
              <span key={e.day} className="h-7 px-2.5 rounded-full border border-slate-700 text-xs text-slate-200 inline-flex items-center">
                {formatAgendaBadge(e)}
              </span>
            ))}
            {weeks.map((w) => (
              <span key={w} className="h-7 px-2.5 rounded-full border border-blue-600 text-xs text-blue-400 inline-flex items-center">
                {cycleWeekLabel(w)}
              </span>
            ))}
          </div>
        )}

        {/* Informações */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className={label}>Local</span>
            <span className="text-[15px] text-slate-100">{doc.complemento || 'Consultório próprio'}</span>
            {address && <span className="text-sm text-slate-400">{address}</span>}
          </div>
          <div className="h-px bg-slate-800" />
          <div className="flex justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className={label}>Horário médio</span>
              <span className="text-[15px] text-slate-100">
                {expected
                  ? `${formatMinutes(expected.startMinutes)}${expected.endMinutes !== null ? ` – ${formatMinutes(expected.endMinutes)}` : ''}`
                  : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 items-end">
              <span className={label}>Visita</span>
              <span className={`text-[15px] ${visitedAt ? 'text-emerald-400' : 'text-slate-100'}`}>
                {visitedAt ? `${shortDate(visitedAt)} às ${formatTime(visitedAt)}` : 'Pendente'}
              </span>
            </div>
          </div>
          {doc.observacoes && (
            <>
              <div className="h-px bg-slate-800" />
              <div className="flex flex-col gap-0.5">
                <span className={label}>Observação</span>
                <span className="text-sm text-slate-200">{doc.observacoes}</span>
              </div>
            </>
          )}
        </div>

        {/* Status de um toque */}
        <div className="flex flex-col gap-2">
          <span className={label}>Status · um toque</span>
          <div className="grid grid-cols-2 gap-2">
            {QUICK.map((q) => {
              const active = has(q.type);
              const remaining = active ? minutesRemaining(active.expires_at) : null;
              return (
                <button
                  key={q.type}
                  type="button"
                  aria-pressed={Boolean(active)}
                  onClick={() => toggleQuick(q.type)}
                  className={`min-h-12 px-3 py-2 rounded-xl border text-left flex flex-col justify-center ${
                    active ? `${q.on} ${q.text}` : `border-slate-700 bg-slate-800 ${q.text}`
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {active ? '● ' : ''}
                    {q.label}
                  </span>
                  {active && (
                    <span className="text-[11px] opacity-80">
                      {STATUS_META[q.type].showTime ? `às ${formatTime(active.created_at)}` : 'hoje'}
                      {remaining !== null && remaining > 0 ? ` · ${remaining} min` : ''} · toque p/ remover
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Licença / Viagem */}
        <div className="flex flex-col gap-2">
          <span className={label}>Ausência</span>
          <div className="grid grid-cols-2 gap-2">
            {ABSENCE.map((a) => {
              const active = has(a.type);
              return (
                <button
                  key={a.type}
                  type="button"
                  aria-pressed={Boolean(active) || absence === a.type}
                  onClick={() => {
                    if (active) onClearStatus(doc.id, a.type);
                    else setAbsence(absence === a.type ? null : a.type);
                  }}
                  className={`min-h-12 px-3 py-2 rounded-xl border text-left flex flex-col justify-center text-amber-400 ${
                    active || absence === a.type ? 'border-amber-400 bg-amber-500/15' : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {active ? '● ' : ''}
                    {a.label}
                  </span>
                  {active?.return_date && (
                    <span className="text-[11px] opacity-80">Volta {shortDate(active.return_date)} · toque p/ remover</span>
                  )}
                </button>
              );
            })}
          </div>
          {absence && (
            <div className="flex gap-2 items-end">
              <label className="flex-1 flex flex-col gap-1">
                <span className="text-xs text-slate-400">Volta em</span>
                <input
                  type="date"
                  min={todayIso()}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100"
                />
              </label>
              <button
                type="button"
                disabled={!returnDate}
                onClick={confirmAbsence}
                className="h-11 px-4 rounded-xl border-0 bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
              >
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {whatsAppUrl ? (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-[52px] rounded-2xl border border-slate-700 bg-slate-800 text-slate-100 text-sm font-semibold no-underline flex items-center justify-center"
            >
              WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="h-[52px] rounded-2xl border border-slate-700 bg-slate-800 text-slate-100 text-sm font-semibold opacity-40"
            >
              WhatsApp
            </button>
          )}
          <button
            type="button"
            disabled={!onNavigate}
            onClick={() => onNavigate?.()}
            className="h-[52px] rounded-2xl border border-slate-700 bg-slate-800 text-slate-100 text-sm font-semibold disabled:opacity-40"
          >
            Ir (GPS)
          </button>
          <button
            type="button"
            onClick={onToggleVisited}
            aria-pressed={Boolean(visitedAt)}
            className={`h-[52px] rounded-2xl text-sm font-bold ${
              visitedAt
                ? 'border border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                : 'border-0 bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {visitedAt ? 'Desfazer' : '✓ Visitado'}
          </button>
        </div>
        {!visitedAt && activeWeekLabel && (
          <span className="-mt-2 text-center text-xs text-slate-500">O visitado entra na {activeWeekLabel}</span>
        )}
      </div>
    </div>
  );
}
