'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Doctor, DoctorLocation, ExpectedVisit } from '@/types/doctor';
import LocationPills from '@/components/LocationPills';
import { getLocations, locationMapsUrl, todayLocation } from '@/lib/locations';
import { normalizeCycleWeeks } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import type { ComboOption } from '@/components/ComboBox';
import BottomSheet from '@/components/BottomSheet';
import DoctorEditForm from '@/components/DoctorEditForm';
import DoctorHistory from '@/components/DoctorHistory';
import StatusHistory from '@/components/StatusHistory';
import StatusSheet from '@/components/StatusSheet';
import { RepAvatar } from '@/components/RepAvatar';
import type { PresenceItem, PublicProfile, Visitor } from '@/lib/visits';
import {
  doctorWhatsApps,
  formatAgendaBadge,
  formatMinutes,
  formatCrm,
  getAgenda,
  isNewDoctor,
  specialtyCode,
} from '@/utils';

/* ── Ficha do médico: página com cabeçalho, chips, quem está lá, 4 ações e informações ── */

const NO_PROFILES: Readonly<Record<string, PublicProfile>> = {};

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
  /** edição dentro da própria ficha; ao salvar/cancelar volta para a ficha */
  cityOptions: ComboOption[];
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  /** grava os locais extras do médico */
  onSaveExtras?: (doctorId: string, extras: readonly DoctorLocation[]) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
}

const label = 'text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400';

/** "1ª e 3ª sem", "1ª, 2ª e 3ª sem" */
function weeksLabel(weeks: number[]): string {
  if (weeks.length === 0) return '';
  const parts = weeks.map((w) => `${w}ª`);
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
  return `${joined} sem`;
}

/** Número para o botão Ligar (telefone, ou o WhatsApp da clínica, ou o do médico) */
function callHref(doc: Doctor): string | null {
  const raw = doc.telefone || doc.whatsapp_clinica || doc.whatsapp_medico || '';
  const d = raw.replace(/\D/g, '');
  if (d.length < 8) return null;
  return `tel:${d.length <= 11 ? `+55${d}` : `+${d}`}`;
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayHhmm = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hhmm(iso)}`;
};

/** Botão de WhatsApp da escolha; sem número fica desligado */
function WhatsOption({ href, title, sub }: { href: string | null; title: string; sub: string }) {
  const body = (
    <>
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-slate-100">{title}</span>
        <span className="text-[13px] text-slate-400">{href ? sub : 'Número não cadastrado'}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-500" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </>
  );
  const cls = 'flex min-h-16 items-center gap-3 rounded-[14px] border border-slate-800 bg-slate-950 px-3.5 text-left no-underline';
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <div className={`${cls} opacity-50`}>{body}</div>
  );
}

/** Um dos 4 botões grandes da ficha */
function Tile({
  children,
  text,
  primary = false,
  disabled = false,
  href,
  onClick,
}: {
  children: ReactNode;
  text: string;
  primary?: boolean;
  disabled?: boolean;
  href?: string | null;
  onClick?: () => void;
}) {
  const cls = `flex h-16 flex-col items-center justify-center gap-1 rounded-[14px] text-xs no-underline ${
    primary ? 'border-0 bg-blue-600 font-bold text-white' : 'border border-slate-800 bg-slate-900 font-semibold text-slate-100'
  } ${disabled ? 'pointer-events-none opacity-40' : ''}`;
  const content = (
    <>
      {children}
      {text}
    </>
  );
  if (href && !disabled) {
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cls}>
      {content}
    </button>
  );
}

const ico = (d: ReactNode, w = 1.8) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

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
  onSaveExtras,
  onDelete,
  onClose,
}: DoctorSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [whatsOpen, setWhatsOpen] = useState(false);
  const [mode, setMode] = useState<'status' | 'edit'>('status');
  const locais = getLocations(doc);
  const multi = locais.length > 1;
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selected = locais.find((l) => l.id === pickedId) ?? todayLocation(locais);
  const openPlace = (loc: DoctorLocation) => {
    const url = locationMapsUrl(loc);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

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

  const agenda = getAgenda(doc);
  const weeks = normalizeCycleWeeks(doc.cycle_weeks);
  const whats = doctorWhatsApps(doc);
  const call = callHref(doc);
  const code = specialtyCode(doc.especialidade);
  const address = [[doc.endereco, doc.numero].filter(Boolean).join(', '), doc.bairro, doc.cidade].filter(Boolean).join(' · ');
  const inOffice = (presence ?? []).filter((p) => p.kind === 'office');
  const visitedBy = (presence ?? []).filter((p) => p.kind === 'visit');
  const sub = [doc.especialidade, doc.crm ? formatCrm(doc.crm, doc.uf) : '', doc.rqe ? `RQE ${doc.rqe}` : ''].filter(Boolean).join(' · ');

  const chip = 'inline-flex h-6 items-center rounded-md px-2 text-[11px] font-bold';

  const person = (p: PresenceItem, tone: 'sky' | 'emerald') => (
    <div key={p.key} className="flex items-center gap-2.5">
      <RepAvatar name={p.name} src={p.avatarUrl} me={p.isMe} size={28} />
      <span className="flex-1 text-sm text-slate-100">
        {p.name}
        {p.isMe && <span className="text-slate-400"> (você)</span>}
      </span>
      <span className={`text-[13px] tabular-nums ${tone === 'sky' ? 'text-slate-400' : 'text-emerald-300'}`}>
        {p.kind === 'visit' ? dayHhmm(p.at) : hhmm(p.at)}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 animate-[fade-in_.18s_ease-out]">
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Ficha de ${doc.descricao}`} className="mx-auto flex h-full w-full max-w-xl flex-col">
        {/* Cabeçalho: voltar · Editar · mais opções */}
        <header className="flex items-center gap-2 px-3 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
          <button
            type="button"
            aria-label={mode === 'edit' ? 'Voltar para a ficha' : 'Voltar'}
            onClick={() => (mode === 'edit' ? setMode('status') : onClose())}
            className="flex size-11 items-center justify-center rounded-xl border-0 bg-transparent text-slate-100"
          >
            {ico(<path d="M15 6l-6 6 6 6" />, 2)}
          </button>
          <span className="flex-1 truncate text-sm font-semibold uppercase tracking-[0.08em] text-blue-400">
            {mode === 'edit' ? 'Editando dados' : ''}
          </span>
          {mode === 'status' && (
            <>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="h-11 rounded-xl border border-slate-800 bg-slate-900 px-3.5 text-sm font-semibold text-slate-100"
              >
                Editar
              </button>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Mais opções"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex size-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-100"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setMenuOpen(false)} />
                    <div role="menu" className="absolute right-0 top-12 z-20 flex w-64 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl shadow-black/60">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        className="flex min-h-[52px] items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left hover:bg-red-500/10"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-300" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                        <span className="text-[15px] font-medium text-red-300">Excluir do meu painel</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pb-8" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>
          {/* Nome, especialidade/CRM e chips */}
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-2xl font-bold uppercase tracking-tight text-white">
              {doc.descricao}
              {isNewDoctor(doc) && <span className="ml-2 align-middle text-[10px] font-bold text-green-400">NOVO</span>}
            </h1>
            {sub && <span className="text-[13px] text-slate-400">{sub}</span>}
            {(code || agenda.length > 0 || weeks.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {code && <span className={`${chip} bg-rose-950 text-rose-300`}>{code}</span>}
                {agenda.map((e) => (
                  <span key={e.day} className={`${chip} bg-slate-800 text-slate-300`}>
                    {formatAgendaBadge(e)}
                  </span>
                ))}
                {weeks.length > 0 && <span className={`${chip} bg-blue-950 text-blue-300`}>{weeksLabel(weeks)}</span>}
              </div>
            )}
          </div>

          {mode === 'edit' ? (
            <DoctorEditForm
              doc={doc}
              cityOptions={cityOptions}
              onUpdateDoctor={onUpdateDoctor}
              onSaveExtras={onSaveExtras}
              onDone={() => {
                setMode('status');
                panelRef.current?.querySelector('.overflow-y-auto')?.scrollTo({ top: 0 });
              }}
            />
          ) : (
            <>
              {/* Agora no consultório */}
              {inOffice.length > 0 && (
                <section className="flex flex-col gap-2 rounded-2xl border border-sky-500 bg-sky-500/10 px-3.5 py-3">
                  <span className="text-xs font-bold text-sky-300">Agora no consultório</span>
                  {inOffice.map((p) => person(p, 'sky'))}
                </section>
              )}
              {visitedBy.length > 0 && (
                <section className="flex flex-col gap-2 rounded-2xl border border-emerald-700 bg-emerald-500/10 px-3.5 py-3">
                  <span className="text-xs font-bold text-emerald-300">Já visitaram neste ciclo</span>
                  {visitedBy.map((p) => person(p, 'emerald'))}
                </section>
              )}

              {/* 4 ações */}
              <div className="grid grid-cols-4 gap-2">
                <Tile primary onClick={() => setStatusOpen(true)} text="Status">
                  {ico(<path d="M5 21V4M5 4h11l-2.5 4L16 12H5" />, 2)}
                </Tile>
                <Tile
                  disabled={multi ? !locationMapsUrl(selected) : !onNavigate}
                  onClick={() => (multi ? openPlace(selected) : onNavigate?.())}
                  text="Rota"
                >
                  {ico(<><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>)}
                </Tile>
                <Tile disabled={!whats.medico && !whats.clinica} onClick={() => setWhatsOpen(true)} text="WhatsApp">
                  {ico(<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />)}
                </Tile>
                <Tile disabled={!call} href={call} text="Ligar">
                  {ico(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />)}
                </Tile>
              </div>
              {!visitedAt && activeWeekLabel && (
                <span className="-mt-1.5 text-center text-xs text-slate-500">O visitado entra na {activeWeekLabel}</span>
              )}

              {/* Vários locais: pílulas, endereço do escolhido e GPS */}
              {multi && (
                <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5">
                  <LocationPills locais={locais} selectedId={selected.id} onSelect={setPickedId} onNavigate={openPlace} />
                </section>
              )}

              {/* Local, endereço, horário médio e observação */}
              <section className={`flex flex-col rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-1 ${multi && !expected && !doc.observacoes ? 'hidden' : ''}`}>
                {[
                  ...(multi ? [] : [['Local', doc.complemento || 'Consultório próprio'], ['Endereço', address]]),
                  ['Horário médio', expected ? `${formatMinutes(expected.startMinutes)}${expected.endMinutes !== null ? ` – ${formatMinutes(expected.endMinutes)}` : ''}` : ''],
                  ['Obs.', doc.observacoes ?? ''],
                ]
                  .filter(([, v]) => Boolean(v))
                  .map(([k, v], i, arr) => (
                    <div key={k} className={`flex gap-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-slate-800' : ''}`}>
                      <span className="w-[76px] shrink-0 text-[13px] text-slate-500">{k}</span>
                      <span className="flex-1 text-[13px] text-slate-100">{v}</span>
                    </div>
                  ))}
              </section>

              {/* Últimos status (quem marcou e quando) e últimas edições */}
              <StatusHistory doctorId={doc.id} statuses={statuses} profiles={profiles ?? NO_PROFILES} showLocation={(doc.locais?.length ?? 0) > 1} />
              <div className="flex flex-col gap-2">
                <span className={label}>Últimas edições</span>
                <DoctorHistory doc={doc} />
              </div>
            </>
          )}
        </div>
      </div>

      {whatsOpen && (
        <BottomSheet title="Abrir WhatsApp de quem?" onClose={() => setWhatsOpen(false)}>
          <div className="grid grid-cols-1 gap-2">
            <WhatsOption href={whats.medico} title="WhatsApp do médico" sub={doc.whatsapp_medico ?? ''} />
            <WhatsOption href={whats.clinica} title="WhatsApp da clínica" sub={doc.whatsapp_clinica || doc.telefone || ''} />
          </div>
          {(!whats.medico || !whats.clinica) && (
            <p className="m-0 text-xs text-slate-500">O número que falta pode ser cadastrado em Editar dados.</p>
          )}
        </BottomSheet>
      )}

      {statusOpen && (
        <StatusSheet
          doctorId={doc.id}
          doctorName={doc.descricao}
          doctorSubtitle={[code, doc.bairro].filter(Boolean).join(' · ')}
          statuses={statuses}
          visited={Boolean(visitedAt)}
          onSet={onSetStatus}
          onClear={onClearStatus}
          onToggleVisited={(v) => {
            if (v !== Boolean(visitedAt)) onToggleVisited();
          }}
          onClose={() => setStatusOpen(false)}
        />
      )}
    </div>
  );
}
