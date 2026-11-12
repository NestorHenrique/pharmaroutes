'use client';

import { useState, type ReactNode } from 'react';
import BottomSheet from '@/components/BottomSheet';
import ReturnDatePicker from '@/components/ReturnDatePicker';
import StatusGuide from '@/components/StatusGuide';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { PROLONGED_STATUSES, STATUS_META } from '@/types/status';
import { formatTime } from '@/utils';
import { shortName } from '@/lib/visits';

/* ── Folha "Marcar status": acesso rápido. Bandeira + 1 toque no status = pronto (2 toques) ── */

type Key = DoctorStatusType | 'visited';

interface Option {
  key: Key;
  label: string;
  hint: string;
  /** borda e fundo quando marcado */
  on: string;
  /** cor do círculo e do visto */
  circle: string;
  check: string;
  icon: ReactNode;
}

const svg = (d: ReactNode, w = 2.2) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

/** Ordem da tela. "Já visitei" não é um status do banco: chama a visita do ciclo. */
const OPTIONS: Option[] = [
  { key: 'representante_no_consultorio', label: 'Rep. no consultório', hint: 'Cheguei agora', on: 'border-sky-500 bg-sky-500/10', circle: 'bg-sky-500', check: 'text-sky-500', icon: svg(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>) },
  { key: 'aguardando_medico', label: 'Aguardando médico', hint: 'Contador de 30 min', on: 'border-amber-500 bg-amber-500/10', circle: 'bg-amber-500', check: 'text-amber-500', icon: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
  { key: 'ultimo_paciente', label: 'Último paciente', hint: 'Avisa os reps da cidade', on: 'border-red-500 bg-red-500/10', circle: 'bg-red-500', check: 'text-red-500', icon: svg(<path d="M12 6v7M12 17.5v.5" />, 2.4) },
  { key: 'visited', label: 'Já visitei', hint: 'Registra nome e hora', on: 'border-emerald-500 bg-emerald-500/10', circle: 'bg-emerald-500', check: 'text-emerald-500', icon: svg(<path d="M5 12l5 5L20 7" />, 3) },
  { key: 'finalizou_atendimento', label: 'Finalizou o atendimento', hint: '', on: 'border-slate-500 bg-slate-500/10', circle: 'bg-slate-600', check: 'text-slate-300', icon: svg(<path d="M5 21V4M5 4h11l-2.5 4L16 12H5" />) },
  { key: 'nao_veio_hoje', label: 'Não veio hoje', hint: '', on: 'border-slate-500 bg-slate-500/10', circle: 'bg-slate-600', check: 'text-slate-300', icon: svg(<path d="M6 6l12 12M18 6L6 18" />, 2.4) },
];

const ATTENDANCE: DoctorStatusType[] = OPTIONS.filter((o) => o.key !== 'visited').map((o) => o.key as DoctorStatusType);

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface StatusSheetProps {
  doctorName: string;
  /** "ORT · Centro" (especialidade e bairro) */
  doctorSubtitle?: string;
  statuses: readonly DoctorStatus[];
  /** o médico já está visitado (ciclo ou dia) */
  visited: boolean;
  onSet: (doctorId: string, type: DoctorStatusType, opts?: { returnDate?: string }) => void;
  onClear: (doctorId: string, type: DoctorStatusType) => void;
  /** liga/desliga a visita; sem ela, "Já visitei" não aparece */
  onToggleVisited?: (visited: boolean) => void;
  doctorId: string;
  /** médico com mais de um local: o local escolhido aparece junto do status */
  locationName?: string;
  onClose: () => void;
}

export default function StatusSheet({
  doctorId,
  doctorName,
  doctorSubtitle,
  statuses,
  visited,
  onSet,
  onClear,
  onToggleVisited,
  locationName,
  onClose,
}: StatusSheetProps) {
  const active = new Map(statuses.map((s) => [s.status_type, s]));

  const [step, setStep] = useState<'main' | 'until'>('main');
  const [untilType, setUntilType] = useState<DoctorStatusType | null>(null);
  const [untilDate, setUntilDate] = useState('');
  const [guide, setGuide] = useState(false);

  /** Um toque: marca (ou tira, se já estava marcado) e fecha a folha */
  const choose = (key: Key) => {
    if (key === 'visited') {
      if (visited) {
        onToggleVisited?.(false);
      } else {
        // "Já visitei" encerra o atendimento: limpa os status de atendimento que estavam ativos
        for (const t of ATTENDANCE) if (active.has(t)) onClear(doctorId, t);
        onToggleVisited?.(true);
      }
    } else if (active.has(key)) {
      onClear(doctorId, key);
    } else {
      onSet(doctorId, key);
    }
    onClose();
  };

  const chooseAbsence = (type: DoctorStatusType) => {
    if (active.has(type)) {
      onClear(doctorId, type);
      onClose();
      return;
    }
    setUntilType(type);
    setUntilDate('');
    setStep('until');
  };

  const confirmUntil = () => {
    if (!untilType || !untilDate) return;
    onSet(doctorId, untilType, { returnDate: untilDate });
    onClose();
  };

  if (step === 'until' && untilType) {
    return (
      <BottomSheet
        title="Até quando?"
        onClose={() => setStep('main')}
        dismissOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              onClick={() => setStep('main')}
              className="h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-5 text-sm font-medium text-slate-300 hover:text-white"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!untilDate}
              onClick={confirmUntil}
              className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Confirmar
            </button>
          </>
        }
      >
        <p className="m-0 text-sm text-slate-300">
          {doctorName} · <strong className="text-amber-400">{STATUS_META[untilType].label}</strong>
        </p>
        <ReturnDatePicker value={untilDate} onChange={setUntilDate} />
      </BottomSheet>
    );
  }

  const visible = OPTIONS.filter((o) => o.key !== 'visited' || onToggleVisited);
  const full = visible.slice(0, 4).filter((o) => o.key !== 'finalizou_atendimento' && o.key !== 'nao_veio_hoje');
  const half = visible.filter((o) => o.key === 'finalizou_atendimento' || o.key === 'nao_veio_hoje');

  const row = (o: Option, compact: boolean) => {
    const on = o.key === 'visited' ? visited : active.has(o.key);
    const current = o.key === 'visited' ? null : active.get(o.key);
    return (
      <button
        key={o.key}
        type="button"
        aria-pressed={on}
        onClick={() => choose(o.key)}
        className={`flex min-h-14 items-center text-left ${compact ? 'gap-2.5 px-3' : 'gap-3 px-3.5'} rounded-[14px] ${
          on ? `border-2 ${o.on}` : 'border border-slate-800 bg-slate-950'
        } text-slate-100`}
      >
        <span className={`flex shrink-0 items-center justify-center rounded-full text-slate-950 ${o.circle} ${compact ? 'size-[30px]' : 'size-[34px]'} ${o.circle === 'bg-slate-600' ? 'text-slate-100' : ''}`}>
          {o.icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`${compact ? 'text-[13px] leading-tight' : 'text-[15px]'} font-semibold`}>{o.label}{locationName && o.key !== 'finalizou_atendimento' && o.key !== 'nao_veio_hoje' ? ` · ${locationName}` : ''}</span>
          {!compact && (
            <span className="text-xs text-slate-400">
              {on && current
                ? `${current.rep_name ? `${shortName(current.rep_name)} ` : ''}${formatTime(current.created_at)} · toque p/ remover`
                : on
                  ? 'toque p/ remover'
                  : o.hint}
            </span>
          )}
        </span>
        {on && !compact && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${o.check}`} aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>
    );
  };

  return (
    <>
      <BottomSheet title="Marcar status" onClose={onClose}>
        <div className="-mt-2 flex flex-col gap-1">
          <span className="truncate text-[13px] uppercase text-slate-400">
            {doctorName}
            {doctorSubtitle ? ` · ${doctorSubtitle}` : ''}
          </span>
          <button
            type="button"
            onClick={() => setGuide(true)}
            className="inline-flex min-h-9 items-center gap-1.5 self-start border-0 bg-transparent p-0 text-[13px] font-semibold text-blue-400 hover:underline"
          >
            <span className="grid size-[18px] place-items-center rounded-full border border-blue-800 text-[11px]">?</span>
            Ver guia de cores e status
          </button>
        </div>

        <div className="flex flex-col gap-2" role="group" aria-label="Status">
          {full.map((o) => row(o, false))}
          <div className="grid grid-cols-2 gap-2">{half.map((o) => row(o, true))}</div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Ausência prolongada</span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Ausência prolongada">
            {PROLONGED_STATUSES.map((t) => {
              const cur = active.get(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={Boolean(cur)}
                  onClick={() => chooseAbsence(t)}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-[14px] px-2 text-center text-sm font-semibold text-amber-400 ${
                    cur ? 'border-2 border-amber-500 bg-amber-500/10' : 'border border-slate-800 bg-slate-950'
                  }`}
                >
                  {STATUS_META[t].label}
                  {cur && (
                    <span className="text-[11px] font-medium opacity-80">
                      {cur.return_date ? `volta ${shortDate(cur.return_date)} · ` : ''}toque p/ remover
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-slate-500">Ao escolher, pede a data de retorno.</span>
        </div>
      </BottomSheet>
      {guide && <StatusGuide onClose={() => setGuide(false)} />}
    </>
  );
}
