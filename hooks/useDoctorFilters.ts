import { useMemo } from 'react';
import type { Doctor, ExpectedVisit, HistoricalShift, RouteTier } from '@/types/doctor';
import { ROUTE_END_STATUSES, ROUTE_START_STATUSES, TOP_PRIORITY_STATUSES } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusEvent } from '@/types/status';
import { UNAVAILABLE_STATUSES } from '@/types/status';
import { getAgenda, ROUTE_HISTORY_DAYS, ROUTE_SAMPLES_SAME_DAY } from '@/utils';

export type SortMode = 'historico' | 'manual';

const DAY_INDEX: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

/** Turnos do histórico: manhã < 12h · tarde < 18h · noite depois disso */
export function shiftOfHour(hour: number): HistoricalShift {
  if (hour < 12) return 'MANHA';
  if (hour < 18) return 'TARDE';
  return 'NOITE';
}

/* ═══════════════ Média histórica (todos os representantes) ═══════════════ */

interface HistWindow {
  startMinutes: number | null;
  endMinutes: number | null;
  samples: number;
  shift: HistoricalShift;
}

interface DayAcc {
  ts: number;
  start: number | null; // primeiro clique de início do dia
  end: number | null; // último clique de fim do dia
}

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * Agrupa os eventos por (médico, dia da semana, turno). Só o dia da semana `day` é usado,
 * então a segunda-feira nunca contamina a quarta. Dentro de cada grupo pega, por data,
 * o primeiro início e o último fim, e faz a média das últimas ocorrências.
 */
export function computeHistoricalWindows(
  events: readonly DoctorStatusEvent[],
  day: string,
  nowMs: number,
): Map<string, HistWindow[]> {
  const weekday = DAY_INDEX[day] ?? new Date(nowMs).getDay();
  const oldest = nowMs - ROUTE_HISTORY_DAYS * 86_400_000;

  // doctor → turno → data → acumulador
  const groups = new Map<string, Map<HistoricalShift, Map<string, DayAcc>>>();

  for (const e of events) {
    const isStart = ROUTE_START_STATUSES.includes(e.status_type);
    const isEnd = ROUTE_END_STATUSES.includes(e.status_type);
    if (!isStart && !isEnd) continue;

    const d = new Date(e.event_at);
    const ts = d.getTime();
    if (Number.isNaN(ts) || ts < oldest || ts > nowMs || d.getDay() !== weekday) continue;

    const minutes = d.getHours() * 60 + d.getMinutes();
    const shift = shiftOfHour(d.getHours());
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    const byShift = groups.get(e.doctor_id) ?? new Map<HistoricalShift, Map<string, DayAcc>>();
    const byDate = byShift.get(shift) ?? new Map<string, DayAcc>();
    const acc = byDate.get(dateKey) ?? { ts, start: null, end: null };

    if (isStart && (acc.start === null || minutes < acc.start)) acc.start = minutes;
    if (isEnd && (acc.end === null || minutes > acc.end)) acc.end = minutes;
    acc.ts = Math.max(acc.ts, ts);

    byDate.set(dateKey, acc);
    byShift.set(shift, byDate);
    groups.set(e.doctor_id, byShift);
  }

  const result = new Map<string, HistWindow[]>();
  for (const [doctorId, byShift] of groups) {
    const windows: HistWindow[] = [];
    for (const [shift, byDate] of byShift) {
      const recent = Array.from(byDate.values())
        .sort((a, b) => b.ts - a.ts)
        .slice(0, ROUTE_SAMPLES_SAME_DAY);
      const starts = recent.flatMap((x) => (x.start === null ? [] : [x.start]));
      const ends = recent.flatMap((x) => (x.end === null ? [] : [x.end]));
      windows.push({
        shift,
        startMinutes: starts.length ? avg(starts) : null,
        endMinutes: ends.length ? avg(ends) : null,
        samples: starts.length,
      });
    }
    result.set(doctorId, windows);
  }
  return result;
}

/** Turnos do histórico que o turno de agenda cobre */
function shiftsFor(agendaShift: string | undefined): HistoricalShift[] | null {
  switch (agendaShift) {
    case 'MANHA':
      return ['MANHA'];
    case 'TARDE':
      return ['TARDE'];
    case 'NOITE':
      return ['NOITE'];
    case 'INTEGRAL':
      return ['MANHA', 'TARDE'];
    default:
      return null;
  }
}

/** Horário esperado do médico no dia `day`: janela do turno da agenda, senão a de início mais cedo */
export function expectedVisitFor(doc: Doctor, day: string, windows: HistWindow[] | undefined): ExpectedVisit | null {
  if (!windows?.length) return null;
  const usable = windows.filter((w) => w.startMinutes !== null);
  if (!usable.length) return null;

  const allowed = shiftsFor(getAgenda(doc).find((e) => e.day === day)?.shift);
  const inShift = allowed ? usable.filter((w) => allowed.includes(w.shift)) : [];
  const pool = inShift.length ? inShift : usable;

  const best = pool.reduce((a, b) => ((a.startMinutes ?? 0) <= (b.startMinutes ?? 0) ? a : b));
  return {
    startMinutes: best.startMinutes ?? 0,
    endMinutes: best.endMinutes,
    samples: best.samples,
    shift: best.shift,
  };
}

/* ═══════════════ Blocos do feed ═══════════════ */

/** Define o bloco do médico. Entre ativo e concluído vence o status marcado por último. */
export function classifyTier(statuses: readonly DoctorStatus[], categoryMode: boolean): RouteTier {
  const ts = (s: DoctorStatus) => new Date(s.created_at).getTime();
  const latest = (list: DoctorStatus[]) => (list.length ? Math.max(...list.map(ts)) : -1);

  const top = statuses.filter((s) => TOP_PRIORITY_STATUSES.includes(s.status_type));
  const bottom = statuses.filter(
    (s) => UNAVAILABLE_STATUSES.includes(s.status_type) || (categoryMode && s.status_type === 'visitado_hoje'),
  );

  if (!top.length && !bottom.length) return 'middle';
  if (!top.length) return 'bottom';
  if (!bottom.length) return 'top';

  // Licença/Viagem são sempre fim de linha; os demais seguem a ordem dos cliques
  const prolonged = bottom.some((s) => s.status_type === 'ferias' || s.status_type === 'viajando');
  return prolonged || latest(bottom) >= latest(top) ? 'bottom' : 'top';
}

/* ═══════════════ Hook ═══════════════ */

interface Params {
  doctors: Doctor[];
  /** só status ainda válidos, por médico */
  statusMap: Record<string, DoctorStatus[]>;
  events: readonly DoctorStatusEvent[];
  routeDay: string;
  now: number;
  sortMode: SortMode;
  /** ordem manual DESTE representante para o dia (rep_route_order) */
  manualOrder: readonly string[] | undefined;
  categoryMode: boolean;
  /** visitas do ciclo deste representante: doctor_id → visited_at */
  cycleVisits?: ReadonlyMap<string, string>;
}

export interface DoctorFeed {
  top: Doctor[];
  middle: Doctor[];
  /** fim da lista: visitados e depois indisponíveis (junção das duas listas abaixo) */
  bottom: Doctor[];
  /** visitados (ciclo/dia) */
  visited: Doctor[];
  /** indisponíveis (férias, viagem...): sempre por último */
  unavailable: Doctor[];
  /** ids do bloco do meio, na ordem exibida (base das setas ▲▼) */
  middleIds: string[];
  expected: Map<string, ExpectedVisit>;
}

export function useDoctorFilters({
  doctors,
  statusMap,
  events,
  routeDay,
  now,
  sortMode,
  manualOrder,
  categoryMode,
  cycleVisits,
}: Params): DoctorFeed {
  const windows = useMemo(() => computeHistoricalWindows(events, routeDay, now), [events, routeDay, now]);

  const expected = useMemo(() => {
    const out = new Map<string, ExpectedVisit>();
    for (const d of doctors) {
      const e = expectedVisitFor(d, routeDay, windows.get(d.id));
      if (e) out.set(d.id, e);
    }
    return out;
  }, [doctors, routeDay, windows]);

  return useMemo(() => {
    const manualIndex = new Map((manualOrder ?? []).map((id, i) => [id, i]));
    const top: { d: Doctor; ts: number }[] = [];
    const middle: Doctor[] = [];
    const visited: { d: Doctor; ts: number }[] = [];
    const unavailable: { d: Doctor; ts: number }[] = [];

    for (const d of doctors) {
      const list = statusMap[d.id] ?? [];
      let tier = classifyTier(list, categoryMode);
      let ts = list.length ? Math.max(...list.map((s) => new Date(s.created_at).getTime())) : 0;
      // Visitado no ciclo: afunda para o fim (status ativo do topo ainda vence)
      const visitedAt = cycleVisits?.get(d.id);
      if (visitedAt && tier === 'middle') {
        tier = 'bottom';
        ts = new Date(visitedAt).getTime();
      }
      if (tier === 'top') top.push({ d, ts });
      else if (tier === 'bottom') {
        // Indisponível (férias, viagem...) vence: vai para a lista do fim; o resto é visitado
        if (list.some((s) => UNAVAILABLE_STATUSES.includes(s.status_type))) unavailable.push({ d, ts });
        else visited.push({ d, ts });
      }
      else middle.push(d);
    }

    // Topo: marcado mais recentemente primeiro. Fim: concluído por último fica por último.
    top.sort((a, b) => b.ts - a.ts);
    visited.sort((a, b) => a.ts - b.ts);
    unavailable.sort((a, b) => a.ts - b.ts);

    if (sortMode === 'historico') {
      middle.sort((a, b) => {
        const ea = expected.get(a.id)?.startMinutes ?? Number.POSITIVE_INFINITY;
        const eb = expected.get(b.id)?.startMinutes ?? Number.POSITIVE_INFINITY;
        return ea === eb ? 0 : ea - eb; // sem histórico: mantém ordem alfabética
      });
    } else {
      middle.sort((a, b) => {
        const ia = manualIndex.get(a.id) ?? Number.POSITIVE_INFINITY;
        const ib = manualIndex.get(b.id) ?? Number.POSITIVE_INFINITY;
        return ia === ib ? 0 : ia - ib;
      });
    }

    return {
      top: top.map((x) => x.d),
      middle,
      bottom: [...visited, ...unavailable].map((x) => x.d),
      visited: visited.map((x) => x.d),
      unavailable: unavailable.map((x) => x.d),
      middleIds: middle.map((d) => d.id),
      expected,
    };
  }, [doctors, statusMap, categoryMode, sortMode, expected, manualOrder, cycleVisits]);
}
