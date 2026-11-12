/**
 * Aprovação de edições de dados compartilhados.
 * Mudar nome, CRM, UF ou especialidade de um médico vira uma proposta: um colega aprova ou recusa;
 * sem decisão em 24 h ela vale sozinha. Os demais campos (telefone, endereço, agenda...) são editados direto.
 */
export const GUARDED_FIELDS = ['descricao', 'crm', 'uf', 'especialidade'] as const;
export type GuardedField = (typeof GUARDED_FIELDS)[number];

export const FIELD_LABEL: Record<GuardedField, string> = {
  descricao: 'Nome',
  crm: 'CRM',
  uf: 'UF',
  especialidade: 'Especialidade',
};

export const AUTO_APPLY_HOURS = 24;

export type ProposalChanges = Partial<Record<GuardedField, { de: unknown; para: unknown }>>;

export interface EditProposal {
  id: string;
  doctor_id: string;
  proposed_by: string;
  proposed_by_name: string | null;
  changes: ProposalChanges;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
}

export interface ChangeLine {
  label: string;
  de: string;
  para: string;
}

const show = (v: unknown): string => (v === null || v === undefined || String(v).trim() === '' ? '(vazio)' : String(v));

export function changeLines(changes: ProposalChanges): ChangeLine[] {
  return GUARDED_FIELDS.filter((k) => changes[k]).map((k) => ({
    label: FIELD_LABEL[k],
    de: show(changes[k]?.de),
    para: show(changes[k]?.para),
  }));
}

/** Horas que faltam para a proposta valer sozinha (0 = já pode valer) */
export function hoursLeft(createdAt: string, nowMs: number): number {
  const left = AUTO_APPLY_HOURS - (nowMs - new Date(createdAt).getTime()) / 3_600_000;
  return Math.max(0, Math.ceil(left));
}

/** Frases para o retorno da função decide_doctor_edit */
export const DECISION_MESSAGE: Record<string, string> = {
  approved: 'Alteração aprovada e aplicada.',
  rejected: 'Alteração recusada.',
  cancelled: 'Alteração cancelada.',
  conflict: 'Não deu para aplicar: esse CRM já está cadastrado em outro médico.',
  own: 'Quem propôs a alteração não pode aprovar. Peça a um colega.',
  already_decided: 'Essa alteração já foi decidida.',
  not_found: 'Alteração não encontrada.',
  unauthorized: 'Entre na sua conta para decidir.',
};
