export type DoctorStatusType =
  | 'ultimo_paciente'
  | 'representante_no_consultorio'
  | 'nao_veio_hoje'
  | 'ferias'
  | 'viajando'
  | 'saiu_do_setor'
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

/* ── Configuração visual de cada status ── */

export interface StatusMeta {
  label: string;
  emoji: string;
  border: string;
  bg: string;
  text: string;
  /** Duração em minutos (null = expira à meia-noite ou na data de retorno) */
  duration: number | null;
  /** Exige data de retorno? */
  needsReturnDate: boolean;
  /** Exige nome do representante? */
  needsRepName: boolean;
}

export const STATUS_META: Record<DoctorStatusType, StatusMeta> = {
  ultimo_paciente: {
    label: 'Último Paciente',
    emoji: '🔴',
    border: 'border-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    duration: 20,
    needsReturnDate: false,
    needsRepName: false,
  },
  representante_no_consultorio: {
    label: 'Rep. no Consultório',
    emoji: '👤',
    border: 'border-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    duration: 10,
    needsReturnDate: false,
    needsRepName: false,
  },
  nao_veio_hoje: {
    label: 'Não veio hoje',
    emoji: '⚫',
    border: 'border-slate-600',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    duration: null,
    needsReturnDate: false,
    needsRepName: false,
  },
  ferias: {
    label: 'Licença',
    emoji: '🏖️',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    duration: null,
    needsReturnDate: true,
    needsRepName: false,
  },
  viajando: {
    label: 'Viagem',
    emoji: '✈️',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    duration: null,
    needsReturnDate: true,
    needsRepName: false,
  },
  saiu_do_setor: {
    label: 'Saiu do Setor',
    emoji: '🚪',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    duration: null,
    needsReturnDate: false,
    needsRepName: false,
  },
  visitado_hoje: {
    label: 'Já Visitado',
    emoji: '✅',
    border: 'border-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    duration: null,
    needsReturnDate: false,
    needsRepName: false,
  },
};

/** Status rápidos (sem input extra) */
export const QUICK_STATUSES: DoctorStatusType[] = [
  'ultimo_paciente',
  'representante_no_consultorio',
  'nao_veio_hoje',
  'saiu_do_setor',
];

/** Status que precisam de input adicional */
export const INPUT_STATUSES: DoctorStatusType[] = [];

/** Status prolongados (precisam de data de retorno) */
export const PROLONGED_STATUSES: DoctorStatusType[] = [
  'ferias',
  'viajando',
];
