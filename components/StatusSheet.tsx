'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import ReturnDatePicker from '@/components/ReturnDatePicker';
import StatusGuide from '@/components/StatusGuide';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { PROLONGED_STATUSES, STATUS_META } from '@/types/status';
import { formatTime } from '@/utils';

/* ── Folha "Marcar status": sobe de baixo, botões grandes, rodapé Cancelar / Salvar ── */

type Key = DoctorStatusType | 'visited';

interface Option {
  key: Key;
  label: string;
  hint: string;
  /** cor do botão quando marcado */
  on: string;
  text: string;
}

/** Ordem da tela. "Já visitei" não é um status do banco: chama a visita do ciclo. */
const OPTIONS: Option[] = [
  { key: 'representante_no_consultorio', label: 'Rep. no consultório', hint: '10 min · avisa a cidade', on: 'border-sky-500 bg-sky-500/15', text: 'text-sky-400' },
  { key: 'aguardando_medico', label: 'Aguardando médico', hint: '30 min', on: 'border-amber-400 bg-amber-500/15', text: 'text-amber-400' },
  { key: 'ultimo_paciente', label: 'Último paciente', hint: '30 min · avisa a cidade', on: 'border-red-500 bg-red-500/15', text: 'text-red-400' },
  { key: 'visited', label: 'Já visitei', hint: 'Sai da rota neste ciclo', on: 'border-emerald-500 bg-emerald-500/15', text: 'text-emerald-400' },
  { key: 'finalizou_atendimento', label: 'Finalizou o atendimento', hint: 'Até meia-noite', on: 'border-slate-500 bg-slate-500/20', text: 'text-slate-200' },
  { key: 'nao_veio_hoje', label: 'Não veio hoje', hint: 'Até meia-noite', on: 'border-slate-500 bg-slate-500/20', text: 'text-slate-200' },
];

const ATTENDANCE: DoctorStatusType[] = OPTIONS.filter((o) => o.key !== 'visited').map((o) => o.key as DoctorStatusType);

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface StatusSheetProps {
  doctorName: string;
  statuses: readonly DoctorStatus[];
  /** o médico já está visitado (ciclo ou dia) */
  visited: boolean;
  onSet: (doctorId: string, type: DoctorStatusType, opts?: { returnDate?: string }) => void;
  onClear: (doctorId: string, type: DoctorStatusType) => void;
  /** liga/desliga a visita; sem ela, "Já visitei" não aparece */
  onToggleVisited?: (visited: boolean) => void;
  doctorId: string;
  onClose: () => void;
}

export default function StatusSheet({
  doctorId,
  doctorName,
  statuses,
  visited,
  onSet,
  onClear,
  onToggleVisited,
  onClose,
}: StatusSheetProps) {
  const active = new Map(statuses.map((s) => [s.status_type, s]));

  /** o que está marcado na tela (só vale ao tocar em Salvar) */
  const [draft, setDraft] = useState<Set<Key>>(() => {
    const s = new Set<Key>(ATTENDANCE.filter((t) => active.has(t)));
    if (visited) s.add('visited');
    return s;
  });
  /** ausências marcadas na tela: tipo -> data da volta */
  const [absence, setAbsence] = useState<Map<DoctorStatusType, string>>(
    () =>
      new Map(
        PROLONGED_STATUSES.filter((t) => active.get(t)?.return_date).map((t) => [t, active.get(t)!.return_date as string]),
      ),
  );
  const [step, setStep] = useState<'main' | 'until'>('main');
  const [untilType, setUntilType] = useState<DoctorStatusType | null>(null);
  const [untilDate, setUntilDate] = useState('');
  const [guide, setGuide] = useState(false);

  const toggle = (key: Key) =>
    setDraft((cur) => {
      const next = new Set(cur);
      if (next.has(key)) {
        next.delete(key);
      } else if (key === 'visited') {
        // visitado e "no consultório/aguardando..." se contradizem: visitar limpa os de atendimento
        for (const t of ATTENDANCE) next.delete(t);
        next.add('visited');
      } else {
        next.delete('visited');
        next.add(key);
      }
      return next;
    });

  const pickAbsence = (type: DoctorStatusType) => {
    if (absence.has(type)) {
      setAbsence((cur) => {
        const next = new Map(cur);
        next.delete(type);
        return next;
      });
      return;
    }
    setUntilType(type);
    setUntilDate('');
    setStep('until');
  };

  const confirmUntil = () => {
    if (!untilType || !untilDate) return;
    setAbsence((cur) => new Map(cur).set(untilType, untilDate));
    setStep('main');
  };

  // Houve mudança em relação ao que já estava marcado?
  const changed = (() => {
    for (const t of ATTENDANCE) if (draft.has(t) !== active.has(t)) return true;
    if (onToggleVisited && draft.has('visited') !== visited) return true;
    for (const t of PROLONGED_STATUSES) {
      if ((absence.get(t) ?? null) !== (active.get(t)?.return_date ?? null)) return true;
    }
    return false;
  })();

  const save = () => {
    for (const t of ATTENDANCE) {
      const was = active.has(t);
      const now = draft.has(t);
      if (now && !was) onSet(doctorId, t);
      else if (!now && was) onClear(doctorId, t);
    }
    for (const t of PROLONGED_STATUSES) {
      const date = absence.get(t);
      const was = active.get(t);
      if (date && was?.return_date !== date) onSet(doctorId, t, { returnDate: date });
      else if (!date && was) onClear(doctorId, t);
    }
    // por último: "Já visitei" também limpa os status de atendimento que sobraram
    if (onToggleVisited && draft.has('visited') !== visited) onToggleVisited(draft.has('visited'));
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

  return (
    <>
      <BottomSheet
        title="Marcar status"
        onClose={onClose}
        dismissOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-5 text-sm font-medium text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!changed}
              onClick={save}
              className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Salvar
            </button>
          </>
        }
      >
        <p className="m-0 truncate text-sm font-semibold uppercase text-slate-200">{doctorName}</p>

        <div className="grid grid-cols-1 gap-2" role="group" aria-label="Status">
          {OPTIONS.filter((o) => o.key !== 'visited' || onToggleVisited).map((o) => {
            const on = draft.has(o.key);
            const current = o.key === 'visited' ? null : active.get(o.key);
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(o.key)}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-2 text-left ${
                  on ? `${o.on} ${o.text}` : 'border-slate-700 bg-slate-800 text-slate-100'
                }`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{o.label}</span>
                  <span className="text-xs opacity-80">
                    {current && on ? `Marcado às ${formatTime(current.created_at)}${current.rep_name ? ` por ${current.rep_name.split(/\s+/)[0]}` : ''}` : o.hint}
                  </span>
                </span>
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                    on ? 'border-current bg-current' : 'border-slate-600'
                  }`}
                  aria-hidden="true"
                >
                  {on && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-950">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Ausência prolongada</span>
          <div className="grid grid-cols-1 gap-2" role="group" aria-label="Ausência prolongada">
            {PROLONGED_STATUSES.map((t) => {
              const date = absence.get(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={Boolean(date)}
                  onClick={() => pickAbsence(t)}
                  className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-2 text-left ${
                    date ? 'border-amber-400 bg-amber-500/15 text-amber-400' : 'border-slate-700 bg-slate-800 text-slate-100'
                  }`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{STATUS_META[t].label}</span>
                    <span className="text-xs opacity-80">
                      {date ? `Volta ${shortDate(date)} · toque para remover` : 'Escolher até quando'}
                    </span>
                  </span>
                  {!date && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setGuide(true)}
          className="min-h-11 self-start border-0 bg-transparent p-0 text-sm font-semibold text-blue-400 underline-offset-2 hover:underline"
        >
          Ver guia de cores e status
        </button>
      </BottomSheet>
      {guide && <StatusGuide onClose={() => setGuide(false)} />}
    </>
  );
}
