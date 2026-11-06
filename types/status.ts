export type DoctorStatusType =
  | 'ultimo_paciente'
  | 'representante_no_consultorio'
  | 'aguardando_medico'
  | 'nao_veio_hoje'
  | 'finalizou_atendimento'
  | 'ferias'
  | 'viajando'
  | 'visitado_hoje';

export interface DoctorStatus {
  id: string;
  doctor_id: string;
  status_type: DoctorStatusType;
  created_at: string;
  expires_at: string | null;
  return_date: string | null;
  rep_name?: string | null;
  created_by: string;
}

/** Linha de doctor_status_events (histórico de horários) */
export interface DoctorStatusEvent {
  doctor_id: string;
  status_type: DoctorStatusType;
  event_at: string;
}

/* ── Configuração visual de cada status ── */

export interface StatusMeta {
  label: string;
  emoji: string;
  border: string;
  bg: string;
  text: string;
  /** Duração em minutos (null = sem duração fixa) */
  duration: number | null;
  /** Expira à meia-noite do dia em que foi marcado */
  untilMidnight: boolean;
  /** Exige data de retorno? */
  needsReturnDate: boolean;
  /** Exige nome do representante? */
  needsRepName: boolean;
  /** Mostra o horário em que foi marcado */
  showTime: boolean;
}

export const STATUS_META: Record<DoctorStatusType, StatusMeta> = {
  ultimo_paciente: {
    label: 'Último Paciente',
    emoji: '🔴',
    border: 'border-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    duration: 20,
    untilMidnight: false,
    needsReturnDate: false,
    needsRepName: false,
    showTime: true,
  },
  representante_no_consultorio: {
    label: 'Rep. no Consultório',
    emoji: '👤',
    border: 'border-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    duration: 10,
    untilMidnight: false,
    needsReturnDate: false,
    needsRepName: false,
    showTime: true,
  },
  aguardando_medico: {
    label: 'Aguardando Médico',
    emoji: '⏳',
    border: 'border-sky-500',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    duration: 30,
    untilMidnight: false,
    needsReturnDate: false,
    needsRepName: false,
    showTime: true,
  },
  nao_veio_hoje: {
    label: 'Não veio hoje',
    emoji: '⚫',
    border: 'border-slate-600',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    duration: null,
    untilMidnight: true,
    needsReturnDate: false,
    needsRepName: false,
    showTime: false,
  },
  finalizou_atendimento: {
    label: 'Finalizou o Atendimento',
    emoji: '🏁',
    border: 'border-slate-500',
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    duration: null,
    untilMidnight: true,
    needsReturnDate: false,
    needsRepName: false,
    showTime: true,
  },
  ferias: {
    label: 'Licença',
    emoji: '🏖️',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    duration: null,
    untilMidnight: false,
    needsReturnDate: true,
    needsRepName: false,
    showTime: false,
  },
  viajando: {
    label: 'Viagem',
    emoji: '✈️',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    duration: null,
    untilMidnight: false,
    needsReturnDate: true,
    needsRepName: false,
    showTime: false,
  },
  visitado_hoje: {
    label: 'Já Visitado',
    emoji: '✅',
    border: 'border-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    duration: null,
    untilMidnight: true,
    needsReturnDate: false,
    needsRepName: false,
    showTime: true,
  },
};

/** Status rápidos (um toque) */
export const QUICK_STATUSES: DoctorStatusType[] = [
  'ultimo_paciente',
  'representante_no_consultorio',
  'aguardando_medico',
  'finalizou_atendimento',
  'nao_veio_hoje',
];

/** Status que precisam de input adicional */
export const INPUT_STATUSES: DoctorStatusType[] = [];

/** Status prolongados (precisam de data de retorno) */
export const PROLONGED_STATUSES: DoctorStatusType[] = ['ferias', 'viajando'];

/** Status que fixam o card no topo e disparam push para a cidade */
export const PINNED_STATUSES: DoctorStatusType[] = ['ultimo_paciente', 'representante_no_consultorio'];

/** Status cujo horário entra na média móvel da rota */
export const ROUTING_STATUSES: DoctorStatusType[] = ['ultimo_paciente', 'representante_no_consultorio'];

/** Médico indisponível hoje (card esmaecido) */
export const UNAVAILABLE_STATUSES: DoctorStatusType[] = [
  'nao_veio_hoje',
  'finalizou_atendimento',
  'ferias',
  'viajando',
];
