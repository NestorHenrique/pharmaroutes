'use client';

import { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import { prettyCity, type CityOption } from '@/utils';
import { CYCLE_WEEKS, type CycleWeek } from '@/types/doctor';

/**
 * Fluxo da semana (abre sozinho no primeiro acesso de cada segunda-feira, ou pelo botão da semana no topo):
 *   1. "Você está em qual semana do ciclo?"  (atalho "Renovar ciclo agora")
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
  'h-[52px] shrink-0 rounded-[14px] border border-slate-700 bg-slate-950 px-5 text-[15px] font-semibold text-slate-100 disabled:opacity-40';
const primaryBtn =
  'h-[52px] min-w-0 flex-1 rounded-[14px] border-0 bg-blue-600 text-base font-bold text-white hover:bg-blue-500 disabled:opacity-40';

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
        progress={{ step: 2, total: 3 }}
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
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[22px] font-bold leading-tight tracking-tight text-slate-50">Você está em qual semana do ciclo?</h3>
          <p className="m-0 text-[13px] text-slate-400">
            Vale até a próxima segunda-feira. A lista mostra só os médicos marcados para essa semana, e os que você visitar entram nela.
          </p>
        </div>

        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Semana do ciclo">
          {CYCLE_WEEKS.map((w) => {
            const on = week === w;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setWeek(w)}
                className={`flex min-h-[60px] items-center gap-3.5 rounded-2xl px-4 text-left text-slate-50 ${
                  on ? 'border-2 border-blue-600 bg-blue-900' : 'border border-slate-700 bg-slate-950'
                }`}
              >
                <span
                  className={`grid size-[34px] shrink-0 place-items-center rounded-full text-[15px] font-bold ${
                    on ? 'bg-blue-600 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {w}
                </span>
                <span className="flex-1 text-base font-semibold">{w}ª semana</span>
                {w === suggested && !on && <span className="text-[13px] text-slate-500">sugerida</span>}
                {on && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl border border-blue-800 bg-blue-950 p-3.5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-900 text-blue-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />
              </svg>
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm font-bold text-blue-200">Começando um novo ciclo?</span>
              <span className="text-[13px] leading-snug text-slate-300">
                Renove para os médicos já visitados voltarem a aparecer como não visitados. O histórico fica guardado.
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRequestRenew(() => {})}
            className="h-12 rounded-xl border border-blue-600 bg-transparent text-[15px] font-bold text-blue-200"
          >
            Renovar ciclo agora
          </button>
        </div>

        <span className="text-xs leading-snug text-slate-500">
          Errou ou mudou de semana? Toque na semana no topo da tela inicial para trocar.
        </span>
      </BottomSheet>
    );
  }

  /* ── 2. Aviso de ciclo ── */
  if (step === 'cycle') {
    const to5 = notice === 'to5';
    return (
      <BottomSheet
        onClose={() => goAlerts(week ?? 1)}
        dismissOnBackdrop={false}
        footer={
          <div className="flex w-full flex-col gap-2.5">
            <button type="button" onClick={renewThenFirstWeek} className={`${primaryBtn} w-full flex-none`}>
              Renovar ciclo
            </button>
            <button type="button" onClick={() => week && goAlerts(week)} className={`${secondaryBtn} w-full`}>
              {to5 ? 'Seguir na 5ª semana' : 'Lembrar na próxima segunda'}
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-3.5">
          <span
            className={`grid size-[52px] shrink-0 place-items-center rounded-full border ${
              to5 ? 'border-blue-800 bg-blue-950 text-blue-300' : 'border-amber-500 bg-amber-950 text-amber-300'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />
            </svg>
          </span>
          <h3 className="m-0 text-xl font-bold leading-tight text-slate-50">
            {to5 ? 'Você concluiu a 4ª semana' : 'Você concluiu a 5ª semana'}
          </h3>
        </div>
        <p className="m-0 text-sm leading-relaxed text-slate-400">
          {to5 ? (
            <>
              Quer começar um novo ciclo agora? Se preferir, siga na <b className="font-semibold text-slate-50">5ª semana</b>: tudo continua normal, e a gente lembra você quando ela terminar.
            </>
          ) : (
            <>
              Hora de renovar o ciclo. Você volta para a <b className="font-semibold text-slate-50">1ª semana</b> e todos os médicos voltam a ficar como não visitados no seu painel.
            </>
          )}
        </p>
      </BottomSheet>
    );
  }

  /* ── 3. Avisos dos colegas ── */
  const cityLabel = (key: string) => prettyCity(cityOptions.find((o) => o.value === key)?.label ?? key);
  const toggleCity = (key: string) =>
    setCities((cur) => (cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key]));

  return (
    <BottomSheet
      progress={{ step: 3, total: 3 }}
      onClose={onClose}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Agora não
          </button>
          <button type="button" onClick={() => void save()} disabled={busy} className={primaryBtn}>
            {busy ? 'Salvando…' : 'Concluir'}
          </button>
        </>
      }
    >
      <h3 className="m-0 text-[22px] font-bold leading-tight tracking-tight text-slate-50">Quer receber avisos dos colegas?</h3>

      <button
        type="button"
        role="switch"
        aria-checked={notify}
        onClick={() => setNotify((v) => !v)}
        className="flex items-center gap-3 rounded-2xl border border-blue-800 bg-blue-950 p-3.5 text-left"
      >
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-blue-900 text-blue-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-slate-50">Receber notificações</span>
          <span className="text-xs leading-snug text-slate-400">
            Quando um colega marcar <b className="font-semibold text-red-300">Último paciente</b> ou{' '}
            <b className="font-semibold text-sky-300">Rep. no consultório</b>
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`flex h-8 w-[52px] shrink-0 rounded-2xl p-[3px] ${notify ? 'justify-end bg-blue-600' : 'justify-start bg-slate-600'}`}
        >
          <span className="size-[26px] rounded-full bg-slate-950" />
        </span>
      </button>

      {notify && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-[15px] font-semibold text-slate-50">
              Cidades que vou visitar{week ? ` na ${week}ª semana` : ''}
            </span>
            <span className="text-xs font-semibold text-blue-300">
              {cities.length} de {cityOptions.length}
            </span>
          </div>
          <span className="text-xs leading-snug text-slate-500">
            Você só recebe avisos dessas cidades. Elas ficam salvas por semana e já vêm marcadas na próxima vez. Nenhum médico some da sua lista.
          </span>
          <div className="flex flex-wrap gap-2">
            {cityOptions.map((o) => {
              const on = cities.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCity(o.value)}
                  className={`inline-flex h-11 items-center gap-1.5 rounded-full text-sm ${
                    on
                      ? 'border border-blue-600 bg-blue-900 pl-3 pr-3.5 font-semibold text-blue-200'
                      : 'border border-slate-700 bg-slate-950 px-4 text-slate-300'
                  }`}
                >
                  {on && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                  {prettyCity(o.label)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-3">
        <span className="pb-1 text-xs font-bold uppercase tracking-[0.06em] text-slate-400">Cidades salvas por semana</span>
        {CYCLE_WEEKS.map((w, i) => {
          const list = w === week ? cities : savedCities(w);
          return (
            <div key={w} className={`flex items-baseline gap-2.5 py-2 ${i > 0 ? 'border-t border-slate-700' : ''}`}>
              <span className={`w-[34px] text-[13px] font-bold ${w === week ? 'text-blue-300' : 'text-slate-400'}`}>{w}ª</span>
              <span className={`flex-1 text-[13px] ${list.length ? 'text-slate-50' : 'text-slate-500'}`}>
                {list.length ? list.map(cityLabel).join(', ') : 'ainda sem cidades'}
              </span>
              {w === week && (
                <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[11px] font-bold text-slate-950">agora</span>
              )}
            </div>
          );
        })}
      </div>

      <span className="text-xs leading-snug text-slate-500">Para mudar depois, use a seção Cidade dos Filtros na tela inicial.</span>

      {msg && (
        <div role="alert" className="text-xs leading-snug text-red-400">
          {msg}
        </div>
      )}
    </BottomSheet>
  );
}
