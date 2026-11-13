'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import ReturnDatePicker from '@/components/ReturnDatePicker';
import StatusGuide from '@/components/StatusGuide';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { PROLONGED_STATUSES, STATUS_META } from '@/types/status';
import { formatTime } from '@/utils';
import { shortName } from '@/lib/visits';

/* ── Folha "Marcar status" (protótipo copiloto): grade de 2 colunas, um toque no status = pronto ── */

type Key = DoctorStatusType | 'visited';

interface Tile {
  key: DoctorStatusType;
  label: string;
  /** cor do ponto e da borda (classes completas, para o Tailwind enxergar) */
  dot: string;
  idle: string;
  on: string;
  /** pede data de retorno */
  absence?: boolean;
}

const OFF_IDLE = 'border-[1.5px] border-dashed border-slate-500 bg-slate-800';
const OFF_ON = 'border-2 border-slate-300 bg-slate-700';

const TILES: Tile[] = [
  { key: 'representante_no_consultorio', label: 'Rep. no consultório', dot: 'bg-sky-500', idle: 'border-[1.5px] border-sky-500/55 bg-sky-500/10', on: 'border-2 border-sky-500 bg-sky-500/20' },
  { key: 'aguardando_medico', label: 'Aguardando médico', dot: 'bg-amber-400', idle: 'border-[1.5px] border-amber-400/55 bg-amber-400/10', on: 'border-2 border-amber-400 bg-amber-400/20' },
  { key: 'ultimo_paciente', label: 'Último paciente', dot: 'bg-red-500', idle: 'border-[1.5px] border-red-500/55 bg-red-500/10', on: 'border-2 border-red-500 bg-red-500/20' },
  { key: 'finalizou_atendimento', label: 'Finalizou o atendimento', dot: 'bg-slate-500', idle: OFF_IDLE, on: OFF_ON },
  { key: 'nao_veio_hoje', label: 'Não veio hoje', dot: 'bg-slate-500', idle: OFF_IDLE, on: OFF_ON },
  ...PROLONGED_STATUSES.map<Tile>((t) => ({ key: t, label: STATUS_META[t].label, dot: 'bg-slate-500', idle: OFF_IDLE, on: OFF_ON, absence: true })),
];

const ATTENDANCE: DoctorStatusType[] = ['representante_no_consultorio', 'aguardando_medico', 'ultimo_paciente', 'finalizou_atendimento', 'nao_veio_hoje'];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
/** Próxima segunda-feira (se hoje é segunda, a da semana seguinte) */
const nextMonday = () => addDays(((8 - new Date().getDay()) % 7) || 7);
const short = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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
  const [custom, setCustom] = useState(false);
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
    setCustom(false);
    setStep('until');
  };

  const confirmWith = (date: string) => {
    if (!untilType || !date) return;
    onSet(doctorId, untilType, { returnDate: date });
    onClose();
  };

  if (step === 'until' && untilType) {
    const monday = nextMonday();
    const quick: [string, Date][] = [
      ['Amanhã', addDays(1)],
      [`Segunda, ${short(monday)}`, monday],
      ['Em 15 dias', addDays(15)],
      ['Em 30 dias', addDays(30)],
    ];
    return (
      <BottomSheet
        title="Volta quando?"
        onClose={() => setStep('main')}
        dismissOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              onClick={() => setStep('main')}
              className="h-[52px] shrink-0 rounded-[14px] border border-slate-700 bg-transparent px-5 text-base font-medium text-slate-300 hover:text-white"
            >
              Voltar
            </button>
            {custom && (
              <button
                type="button"
                disabled={!untilDate}
                onClick={() => confirmWith(untilDate)}
                className="h-[52px] min-w-0 flex-1 rounded-[14px] border-0 bg-blue-600 text-base font-bold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                Confirmar
              </button>
            )}
          </>
        }
      >
        <span className="-mt-2 truncate text-[13px] uppercase text-slate-400">{doctorName}</span>
        <p className="m-0 text-[13px] text-slate-400">
          <strong className="text-amber-400">{STATUS_META[untilType].label}</strong>. O médico sai da rota até o dia antes da volta.
        </p>
        {custom ? (
          <ReturnDatePicker value={untilDate} onChange={setUntilDate} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {quick.map(([label, d]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => confirmWith(iso(d))}
                  className={`h-[72px] rounded-[18px] px-3 text-left text-[13.5px] font-bold text-slate-100 ${OFF_IDLE}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="flex h-14 items-center justify-center gap-2 rounded-[18px] border border-slate-700 bg-slate-800 text-[15px] font-bold text-slate-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              Escolher data
            </button>
          </>
        )}
      </BottomSheet>
    );
  }

  return (
    <>
      <BottomSheet title="Marcar status" onClose={onClose}>
        <div className="-mt-2 flex flex-col gap-1">
          <span className="truncate text-[13px] uppercase text-slate-400">
            {doctorName}
            {locationName ? ` · ${locationName}` : doctorSubtitle ? ` · ${doctorSubtitle}` : ''}
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

        <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Status">
          {TILES.map((t) => {
            const cur = active.get(t.key);
            const on = Boolean(cur);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => (t.absence ? chooseAbsence(t.key) : choose(t.key))}
                className={`flex h-[72px] flex-col justify-between rounded-[18px] p-3 text-left text-slate-100 ${on ? t.on : t.idle}`}
              >
                <span className="flex items-center justify-between">
                  <span className={`size-3 rounded-full ${t.dot}`} aria-hidden="true" />
                  {on && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13.5px] font-bold leading-tight">{t.label}</span>
                  {on && cur && (
                    <span className="text-[11px] font-medium text-slate-400">
                      {cur.return_date ? `volta ${shortDate(cur.return_date)}` : `${cur.rep_name ? `${shortName(cur.rep_name)} ` : ''}${formatTime(cur.created_at)}`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {onToggleVisited && (
            <button
              type="button"
              aria-pressed={visited}
              onClick={() => choose('visited')}
              className="flex h-[72px] flex-col justify-between rounded-[18px] border-0 bg-emerald-500 p-3 text-left text-slate-950"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
              <span className="flex flex-col">
                <span className="text-[13.5px] font-bold leading-tight">Já visitei</span>
                {visited && <span className="text-[11px] font-semibold opacity-80">toque p/ desfazer</span>}
              </span>
            </button>
          )}
        </div>
      </BottomSheet>
      {guide && <StatusGuide onClose={() => setGuide(false)} />}
    </>
  );
}
