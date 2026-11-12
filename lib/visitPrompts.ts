/**
 * "Já visitou?": quando o status do representante vence (Rep. no consultório 10 min;
 * Aguardando e Último paciente 30 min), o app pergunta se a visita foi feita.
 * A pergunta é a própria linha vencida de doctor_statuses: enquanto ela existir, está pendente.
 * Responder (Sim ou Ainda não) apaga a linha.
 */
import type { DoctorStatusType } from '@/types/status';

export const PROMPT_STATUSES = [
  'representante_no_consultorio',
  'aguardando_medico',
  'ultimo_paciente',
] as const satisfies readonly DoctorStatusType[];

export type PromptStatus = (typeof PROMPT_STATUSES)[number];

/** Pergunta que ficou sem resposta some depois disto (evita "Já visitou?" de dias atrás) */
export const PROMPT_WINDOW_HOURS = 48;

export interface VisitPrompt {
  /** id da linha de doctor_statuses */
  id: string;
  doctor_id: string;
  status_type: PromptStatus;
  /** quando o representante marcou o status */
  created_at: string;
  /** quando o status venceu */
  expires_at: string;
}

/** Quem já visitou o médico depois de marcar o status não precisa responder */
export function alreadyVisited(p: Pick<VisitPrompt, 'doctor_id' | 'created_at'>, myVisits: ReadonlyMap<string, string>): boolean {
  const at = myVisits.get(p.doctor_id);
  if (!at) return false;
  // 1 min de folga: o relógio do aparelho e o do servidor não são idênticos
  return new Date(at).getTime() >= new Date(p.created_at).getTime() - 60_000;
}

/** Texto "1 de 2 perguntas" (vazio com uma só) */
export function roundLabel(answered: number, remaining: number): string | null {
  const total = answered + remaining;
  return total > 1 ? `${answered + 1} de ${total} perguntas` : null;
}
