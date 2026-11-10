import type { DoctorStatusType } from '@/types/status';

export type Shift ='MANHA' | 'TARDE' | 'INTEGRAL' | 'NOITE';

/** Um dia de atendimento com o turno daquele dia. `day` usa os códigos seg..dom */
export interface AgendaEntry {
  day: string;
  shift: Shift;
}

export interface Doctor {
  id: string;
  crm: string;
  descricao: string;
  dia_semana: string;
  dias_semana: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  turno: string;
  observacoes: string;
  telefone: string;
  email: string;
  map_link: string;
  created_at: string;
  updated_by: string;
  /* ── v2 ── */
  categoria?: 'consultorio' | 'psm' | 'samu' | 'hospital' | 'ubs';
  updated_at?: string;
  updated_by_name?: string;
  change_source?: string;
  /** Preparação futura — módulo OCR */
  ocr_status?: 'confirmado' | 'encaixe' | 'ausente';
  /* ── v3 ── */
  especialidade?: string | null;
  uf?: string | null;
  created_via?: 'APP_FIELD' | 'BASE_IMPORT' | null;
  agenda?: AgendaEntry[] | null;
  /* ── v5 ── */
  /** semanas do ciclo (1..5) em que o médico entra na rota */
  cycle_weeks?: number[] | null;
  /* ── v6 ── */
  /** Registro de Qualificação de Especialista */
  rqe?: string | null;
  /** quem cadastrou o médico (auditoria) */
  created_by_name?: string | null;
}

/* ── Ciclo de 5 semanas ── */

export const CYCLE_WEEKS = [1, 2, 3, 4, 5] as const;
export type CycleWeek = (typeof CYCLE_WEEKS)[number];

export const cycleWeekLabel = (w: number): string => `${w}ª Sem`;

/** Situação do médico no ciclo atual DESTE representante */
export type CycleVisitStatus = 'pendente' | 'visitado';

/**
 * "Visitado" do ciclo = linha de doctor_statuses com este status, sem expiração
 * (expires_at = null) e created_by = representante. Fica até "Renovar Ciclo".
 */
export const CYCLE_VISIT_STATUS: DoctorStatusType = 'visitado_hoje';

/** Visita do ciclo já resolvida para a tela */
export interface CycleVisit {
  doctor_id: string;
  status: Extract<CycleVisitStatus, 'visitado'>;
  visited_at: string;
}

/**
 * Semanas do ciclo ficam POR REPRESENTANTE em rep_route_order, uma linha por semana
 * (day_of_week = "ciclo_w1".."ciclo_w5"). A lista é ao mesmo tempo quem está na semana
 * e a ordem da rota dela.
 */
export const cycleWeekKey = (w: number): string => `ciclo_w${w}`;

/** Semanas válidas, sem repetição e em ordem */
export function normalizeCycleWeeks(weeks: readonly number[] | null | undefined): CycleWeek[] {
  const set = new Set((weeks ?? []).filter((w): w is CycleWeek => (CYCLE_WEEKS as readonly number[]).includes(w)));
  return CYCLE_WEEKS.filter((w) => set.has(w));
}

export type AddDoctorResult =
  | { ok: true }
  | { ok: false; error: string; duplicate?: Doctor };

/* ── Feed em 3 blocos + rota histórica ── */

/** top = ativos/urgentes · middle = rota do dia · bottom = indisponíveis/concluídos */
export type RouteTier = 'top' | 'middle' | 'bottom';

/** Status que forçam o card para o TOPO do feed */
export const TOP_PRIORITY_STATUSES: readonly DoctorStatusType[] = [
  'ultimo_paciente',
  'representante_no_consultorio',
  'aguardando_medico',
];

/** Cliques que marcam o INÍCIO da visita (alimentam a média histórica) */
export const ROUTE_START_STATUSES: readonly DoctorStatusType[] = ['representante_no_consultorio', 'aguardando_medico'];

/** Cliques que marcam o FIM da visita / do turno (alimentam a média histórica) */
export const ROUTE_END_STATUSES: readonly DoctorStatusType[] = ['ultimo_paciente', 'finalizou_atendimento'];

/** Todos os status que gravam evento no histórico (espelha o trigger log_doctor_status_event) */
export const ROUTE_EVENT_STATUSES: DoctorStatusType[] = [...ROUTE_START_STATUSES, ...ROUTE_END_STATUSES];

/** Janela horária do histórico agrupada por (médico, dia da semana, turno) */
export type HistoricalShift = Exclude<Shift, 'INTEGRAL'>;

/** Horário esperado da visita, vindo da média de TODOS os representantes */
export interface ExpectedVisit {
  /** minutos desde 00:00 do início esperado */
  startMinutes: number;
  /** minutos desde 00:00 do fim esperado (null = sem registro de fim) */
  endMinutes: number | null;
  /** quantos dias entraram na média de início */
  samples: number;
  shift: HistoricalShift;
}

export interface RepProfile {
  user_id: string;
  display_name: string | null;
  specialties: string[];
  show_all: boolean;
}
