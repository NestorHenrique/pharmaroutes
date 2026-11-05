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
  /* ── v2 fields ── */
  categoria?: 'consultorio' | 'psm' | 'samu' | 'hospital';
  updated_at?: string;
  updated_by_name?: string;
  change_source?: string;
  /** Preparação futura — módulo OCR */
  ocr_status?: 'confirmado' | 'encaixe' | 'ausente';
}
