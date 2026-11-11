'use client';

import { useEffect, useRef, useState } from 'react';
import type { Doctor, ExpectedVisit } from '@/types/doctor';
import { TOP_PRIORITY_STATUSES, cycleWeekLabel, normalizeCycleWeeks } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import type { ComboOption } from '@/components/ComboBox';
import BottomSheet from '@/components/BottomSheet';
import ReturnDatePicker from '@/components/ReturnDatePicker';
import DoctorEditForm from '@/components/DoctorEditForm';
import DoctorHistory from '@/components/DoctorHistory';
import { RepAvatar } from '@/components/RepAvatar';
import type { PresenceItem, PublicProfile, Visitor } from '@/lib/visits';

const NO_PROFILES: Readonly<Record<string, PublicProfile>> = {};
import StatusHistory from '@/components/StatusHistory';
import { STATUS_META } from '@/types/status';
import {
  doctorWhatsApps,
  formatAgendaBadge,
  formatElapsed,
  formatMinutes,
  formatCrm,
  formatTime,
  getAgenda,
  isNewDoctor,
} from '@/utils';

/* ── Ficha do médico: sobe de baixo para cima ── */

interface DoctorSheetProps {
  doc: Doctor;
  statuses: DoctorStatus[];
  expected?: ExpectedVisit | null;
  /** visitado no ciclo (rota) ou no dia (PSM/SAMU/Hospital) */
  visitedAt: string | null;
  /** auditoria da visita ("Visitado por Maria hoje às 10:30"), de qualquer representante */
  visitLabel?: string | null;
  /** quem visitou no ciclo (eu primeiro) */
  visitors?: readonly Visitor[];
  /** quem está no consultório / visitou, com a hora */
  presence?: readonly PresenceItem[];
  /** nome/foto dos representantes (histórico de status) */
  profiles?: Readonly<Record<string, PublicProfile>>;
  /** semana ativa: o visitado entra nela automaticamente */
  activeWeekLabel?: string | null;
  onToggleVisited: () => void;
  onSetStatus: (doctorId: string, type: DoctorStatusType, opts?: { repName?: string; returnDate?: string }) => void;
  onClearStatus: (doctorId: string, type: DoctorStatusType) => void;
  onNavigate: (() => void) | null;
  /** edição dentro da própria ficha; ao salvar/cancelar volta para os status */
  cityOptions: ComboOption[];
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
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
  { type: 'ferias', label: 'Licença / Afastado' },
  { type: 'viajando', label: 'Férias / Viagem' },
];

const label = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';

function shortDate(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

/** Botão de WhatsApp; sem número fica desligado */
function WhatsButton({ href, label: text }: { href: string | null; label: string }) {
  const cls =
    'h-[52px] rounded-2xl border text-sm font-semibold no-underline flex items-center justify-center gap-2';
  const icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5Z" />
    </svg>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} border-emerald-600/50 bg-emerald-500/10 text-emerald-300`}
    >
      {icon}
      {text}
    </a>
  ) : (
    <button type="button" disabled className={`${cls} border-slate-700 bg-slate-800 text-slate-100 opacity-40`}>
      {icon}
      {text}
    </button>
  );
}

export default function DoctorSheet({
  doc,
  statuses,
  expected,
  visitedAt,
  presence,
  profiles,
  activeWeekLabel,
  onToggleVisited,
  onSetStatus,
  onClearStatus,
  onNavigate,
  cityOptions,
  onUpdateDoctor,
  onDelete,
  onClose,
}: DoctorSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'status' | 'edit'>('status');
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
  const whats = doctorWhatsApps(doc);
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
        ref={panelRef}
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
            <h2 className="m-0 text-[22px] font-bold tracking-tight uppercase text-white break-words">
              {doc.descricao}
              {isNewDoctor(doc) && <span className="ml-2 align-middle text-[10px] font-bold text-green-400">NOVO</span>}
            </h2>
            {mode === 'edit' ? (
              <span className="text-sm font-semibold uppercase tracking-[0.08em] text-blue-400">Editando dados</span>
            ) : (doc.especialidade || doc.crm) && (
              <span className="text-sm uppercase text-slate-400">
                {[
                  doc.especialidade,
                  formatCrm(doc.crm, doc.uf),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
          <div className="relative flex gap-1.5 shrink-0">
            {mode === 'status' && (
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
            )}
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
              <>
                <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-20 w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl shadow-black/60 flex flex-col"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setMode('edit');
                    }}
                    className="flex items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left hover:bg-slate-800 active:bg-slate-800"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold text-slate-100">Editar dados</span>
                      <span className="text-xs text-slate-400">Telefones, endereço, agenda</span>
                    </span>
                  </button>
                  <div className="mx-2 my-1 h-px bg-slate-800" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left hover:bg-red-500/10 active:bg-red-500/10"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v5M14 11v5" />
                      </svg>
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold text-red-400">Excluir médico</span>
                      <span className="text-xs text-slate-400">Fica guardado no histórico</span>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {mode === 'edit' ? (
          <DoctorEditForm
            doc={doc}
            cityOptions={cityOptions}
            onUpdateDoctor={onUpdateDoctor}
            onDone={() => {
              setMode('status');
              // Voltou do Editar: sobe ao topo para o botão de fechar ficar à vista
              panelRef.current?.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <>
        {/* Dias, semanas */}
        {(agenda.length > 0 || weeks.length > 0) && (
          <div className="flex gap-1.5 flex-wrap">
            {agenda.map((e) => (
              <span key={e.day} className="h-7 px-2.5 rounded-full border border-slate-700 text-xs text-slate-200 inline-flex items-center uppercase">
                {formatAgendaBadge(e)}
              </span>
            ))}
            {weeks.map((w) => (
              <span key={w} className="h-7 px-2.5 rounded-full border border-blue-600 text-xs text-blue-400 inline-flex items-center uppercase">
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
              <span className={label}>Sua visita</span>
              <span className={`text-right text-[15px] ${visitedAt ? 'text-emerald-400' : 'text-slate-100'}`}>
                {visitedAt ? 'Feita' : 'Pendente'}
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

        {/* Representantes: uma linha por pessoa (foto, nome e o que fez, com data e hora) */}
        {presence && presence.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className={label}>Representantes · {presence.length}</span>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {presence.map((p) => (
                <li
                  key={p.key}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                >
                  <RepAvatar name={p.name} src={p.avatarUrl} me={p.isMe} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {p.name}
                      {p.isMe && <span className="ml-1.5 text-[11px] font-bold text-blue-400">VOCÊ</span>}
                    </span>
                    <span className={`text-xs ${p.kind === 'office' ? 'text-sky-400' : 'text-emerald-400'}`}>
                      {p.kind === 'office' ? 'No consultório desde' : 'Visitou'} {shortDate(p.at)} às {formatTime(p.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Histórico de status: não se perde se o representante esquecer de marcar Visitado */}
        <StatusHistory doctorId={doc.id} statuses={statuses} profiles={profiles ?? NO_PROFILES} />

        {/* Status de um toque */}
        <div className="flex flex-col gap-2">
          <span className={label}>Status · um toque</span>
          <div className="grid grid-cols-2 gap-2">
            {QUICK.map((q) => {
              const active = has(q.type);
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
                    {q.label}
                  </span>
                  {active && (
                    <span className="text-[11px] opacity-80">
                      {TOP_PRIORITY_STATUSES.includes(q.type)
                        ? formatElapsed(active.created_at)
                        : STATUS_META[q.type].showTime
                          ? `às ${formatTime(active.created_at)}`
                          : 'hoje'}{' '}
                      · toque p/ remover
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Licença / Afastado e Férias / Viagem */}
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
            <BottomSheet
              title="Até quando?"
              dismissOnBackdrop={false}
              onClose={() => {
                setAbsence(null);
                setReturnDate('');
              }}
              footer={
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAbsence(null);
                      setReturnDate('');
                    }}
                    className="h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-5 text-sm font-medium text-slate-300 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!returnDate}
                    onClick={confirmAbsence}
                    className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
                  >
                    Confirmar
                  </button>
                </>
              }
            >
              <p className="m-0 text-sm text-slate-300">
                {doc.descricao} · <strong className="text-amber-400">{STATUS_META[absence].label}</strong>
              </p>
              <ReturnDatePicker value={returnDate} onChange={setReturnDate} />
            </BottomSheet>
          )}
        </div>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <WhatsButton href={whats.medico} label="WhatsApp médico" />
          <WhatsButton href={whats.clinica} label="WhatsApp clínica" />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
            {visitedAt ? 'Desfazer visita' : 'Visitado'}
          </button>
        </div>
        {!visitedAt && activeWeekLabel && (
          <span className="-mt-2 text-center text-xs text-slate-500">O visitado entra na {activeWeekLabel}</span>
        )}
        <DoctorHistory doc={doc} />
          </>
        )}
      </div>
    </div>
  );
}
