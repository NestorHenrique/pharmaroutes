'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CityFilter from '@/components/CityFilter';
import type { CityOption } from '@/utils';
import { CYCLE_WEEKS, type CycleWeek } from '@/types/doctor';

/**
 * Fluxo da semana (abre sozinho no primeiro acesso de cada segunda-feira, ou pelo botão da semana no topo):
 *   1. "Você está em qual semana do ciclo?"  (1ª semana: atalho "Renovar ciclo agora")
 *   2. Aviso de ciclo (só no primeiro acesso da semana): 4ª concluída → 5ª; depois da 5ª → renovar
 *   3. "Quer receber avisos dos colegas?"  interruptor + cidades que você vai visitar nessa semana
 */

type Step = 'week' | 'cycle' | 'alerts';
type Notice = 'to5' | 'after5';

interface WeekSetupFlowProps {
  activeWeek: CycleWeek | null;
  /** semana da semana passada (sugere a próxima) */
  lastWeek: CycleWeek | null;
  /** aberto sozinho no primeiro acesso da semana: só aí valem os avisos de ciclo */
  auto: boolean;
  cityOptions: CityOption[];
  /** cidades já salvas para a semana */
  savedCities: (week: number) => string[];
  /** sugestão quando nada foi salvo: cidades dos médicos marcados na semana */
  defaultCities: (week: number) => string[];
  notifyInitial: boolean;
  /** aplica a semana escolhida (filtra os médicos e guarda) */
  onPickWeek: (week: CycleWeek) => void;
  /** pede a confirmação "Começar um novo ciclo?"; `then` roda se ela for confirmada */
  onRequestRenew: (then: () => void) => void;
  /** devolve uma mensagem de erro (ou null se deu certo) */
  onSaveAlerts: (week: CycleWeek, v: { notify: boolean; cities: string[] }) => Promise<string | null>;
  onClose: () => void;
}

const secondaryBtn =
  'h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-5 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-40';
const primaryBtn =
  'h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40';

export default function WeekSetupFlow({
  activeWeek,
  lastWeek,
  auto,
  cityOptions,
  savedCities,
  defaultCities,
  notifyInitial,
  onPickWeek,
  onRequestRenew,
  onSaveAlerts,
  onClose,
}: WeekSetupFlowProps) {
  const suggested: CycleWeek | null = lastWeek !== null ? (((lastWeek % 5) + 1) as CycleWeek) : null;
  const [step, setStep] = useState<Step>('week');
  const [week, setWeek] = useState<CycleWeek | null>(activeWeek ?? suggested);
  const [notice, setNotice] = useState<Notice>('to5');
  const [notify, setNotify] = useState(notifyInitial);
  const [cities, setCities] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const goAlerts = (w: CycleWeek) => {
    const saved = savedCities(w);
    setCities(saved.length > 0 ? saved : defaultCities(w));
    setMsg(null);
    setStep('alerts');
  };

  const next = () => {
    if (!week) return;
    onPickWeek(week);
    if (auto && week === 5 && lastWeek === 4) {
      setNotice('to5');
      setStep('cycle');
    } else if (auto && lastWeek === 5) {
      setNotice('after5');
      setStep('cycle');
    } else {
      goAlerts(week);
    }
  };

  const renewThenFirstWeek = () =>
    onRequestRenew(() => {
      setWeek(1);
      onPickWeek(1);
      goAlerts(1);
    });

  const save = async () => {
    if (!week) return;
    if (notify && cities.length === 0) {
      setMsg('Escolha pelo menos uma cidade para receber os avisos.');
      return;
    }
    setBusy(true);
    const err = await onSaveAlerts(week, { notify, cities });
    setBusy(false);
    if (err) setMsg(err);
    else onClose();
  };

  /* ── 1. Semana ── */
  if (step === 'week') {
    return (
      <BottomSheet
        title="Semana do ciclo"
        onClose={onClose}
        dismissOnBackdrop={false}
        footer={
          <>
            <button type="button" onClick={onClose} className={secondaryBtn}>
              {activeWeek ? 'Fechar' : 'Agora não'}
            </button>
            <button type="button" disabled={!week} onClick={next} className={primaryBtn}>
              Continuar
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-xl font-bold tracking-tight text-slate-50">Você está em qual semana do ciclo?</h3>
          <p className="m-0 text-sm text-slate-400">
            Vale até a próxima segunda-feira. A lista mostra só os médicos marcados para essa semana, e os que você visitar entram nela.
          </p>
        </div>

        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Semana do ciclo">
          {CYCLE_WEEKS.map((w) => {
            const on = week === w;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={on}
                onClick={() => setWeek(w)}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-sm font-bold ${
                  on ? 'border-0 bg-blue-600 text-white' : 'border border-slate-700 bg-slate-800 text-slate-100'
                }`}
              >
                <span className="text-lg leading-none">{w}ª</span>
                <span className="text-[10px] font-medium opacity-80">{w === suggested ? 'sugerida' : 'Sem'}</span>
              </button>
            );
          })}
        </div>

        {week === 1 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-3.5">
            <span className="text-sm font-semibold text-slate-100">Começando um novo ciclo?</span>
            <span className="text-xs leading-snug text-slate-400">
              Renovar zera os &quot;visitados&quot; do seu painel. O histórico fica guardado.
            </span>
            <button
              type="button"
              onClick={() => onRequestRenew(() => {})}
              className="h-11 self-start rounded-xl border border-slate-600 bg-transparent px-4 text-sm font-semibold text-slate-100 hover:border-slate-400"
            >
              Renovar ciclo agora
            </button>
          </div>
        )}
      </BottomSheet>
    );
  }

  /* ── 2. Aviso de ciclo ── */
  if (step === 'cycle') {
    const to5 = notice === 'to5';
    return (
      <BottomSheet
        title="Ciclo de visitas"
        onClose={() => goAlerts(week ?? 1)}
        dismissOnBackdrop={false}
        footer={
          <>
            <button type="button" onClick={() => week && goAlerts(week)} className={secondaryBtn}>
              {to5 ? 'Seguir na 5ª semana' : 'Lembrar na próxima segunda'}
            </button>
            <button type="button" onClick={renewThenFirstWeek} className={primaryBtn}>
              Renovar ciclo
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-xl font-bold tracking-tight text-slate-50">
            {to5 ? 'Você concluiu a 4ª semana' : 'O ciclo de 5 semanas terminou'}
          </h3>
          <p className="m-0 text-sm leading-snug text-slate-400">
            {to5
              ? 'Quer começar um novo ciclo agora ou seguir normalmente na 5ª semana?'
              : 'Renove para começar um novo ciclo na 1ª semana. Se preferir, o app lembra de novo na próxima segunda-feira.'}
          </p>
        </div>
      </BottomSheet>
    );
  }

  /* ── 3. Avisos dos colegas ── */
  return (
    <BottomSheet
      title="Avisos dos colegas"
      onClose={onClose}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Agora não
          </button>
          <button type="button" onClick={() => void save()} disabled={busy} className={primaryBtn}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-xl font-bold tracking-tight text-slate-50">Quer receber avisos dos colegas?</h3>
        <p className="m-0 text-sm text-slate-400">
          Você é avisado quando um colega marca &quot;Último paciente&quot; ou &quot;Rep. no consultório&quot; em uma das cidades da{' '}
          {week ? `${week}ª semana` : 'semana'}.
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={notify}
        onClick={() => setNotify((v) => !v)}
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-800 px-4 text-left"
      >
        <span className="text-[15px] font-semibold text-slate-100">Receber avisos dos colegas</span>
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${notify ? 'bg-blue-600' : 'bg-slate-600'}`}
        >
          <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${notify ? 'left-6' : 'left-1'}`} />
        </span>
      </button>

      {notify && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Cidades que você vai visitar{week ? ` na ${week}ª semana` : ''}
          </span>
          <CityFilter options={cityOptions} selected={cities} onChange={setCities} pickMode />
          <span className="text-xs text-slate-500">
            As cidades ficam salvas por semana. Elas só escolhem os avisos: nenhum médico some da sua lista.
          </span>
        </div>
      )}

      {msg && (
        <div role="alert" className="text-xs leading-snug text-red-400">
          {msg}
        </div>
      )}
    </BottomSheet>
  );
}
