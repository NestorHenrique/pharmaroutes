export type Shift = 'MANHA' | 'TARDE' | 'INTEGRAL' | 'NOITE';

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
  categoria?: 'consultorio' | 'psm' | 'samu' | 'hospital';
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
}

export type AddDoctorResult =
  | { ok: true }
  | { ok: false; error: string; duplicate?: Doctor };

export interface RepProfile {
  user_id: string;
  display_name: string | null;
  specialties: string[];
  show_all: boolean;
}
