/**
 * Histórico de status (doctor_status_events): quem marcou, o quê e quando.
 * Fica guardado mesmo depois que o status expira (ex.: "No consultório" dura 10 min).
 * Desde a migração v9 o gatilho grava todos os status (menos visitado) com o nome do representante.
 */
import { supabase } from '@/lib/supabase';
import type { DoctorStatusType } from '@/types/status';
import type { PublicProfile } from '@/lib/visits';

export interface StatusEventRow {
  id: number;
  doctor_id: string;
  status_type: DoctorStatusType;
  event_at: string;
  created_by: string | null;
  /** v9 */
  rep_name?: string | null;
  /** v9 — Licença/Viagem */
  return_date?: string | null;
  /** nome do local onde foi marcado (médico com mais de um local; ainda não vem do banco) */
  location_name?: string | null;
}

/** Nome de quem marcou: perfil atual, depois o nome gravado no evento */
export function eventRepName(
  e: Pick<StatusEventRow, 'created_by' | 'rep_name'>,
  profiles: Readonly<Record<string, PublicProfile>>,
): string {
  const p = e.created_by ? profiles[e.created_by] : undefined;
  return p?.display_name?.trim() || e.rep_name?.trim() || 'Representante';
}

/** "10/11 13:19" */
export function dayTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

/** Eventos de um médico (mais recentes primeiro) */
export async function fetchDoctorStatusEvents(doctorId: string, limit = 15): Promise<StatusEventRow[] | null> {
  const { data, error } = await supabase
    .from('doctor_status_events')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('event_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('Histórico de status indisponível:', error.message);
    return null;
  }
  return (data ?? []) as StatusEventRow[];
}

/** Eventos de todos os médicos desde `sinceIso` (mais recentes primeiro) */
export async function fetchStatusEventsSince(sinceIso: string, limit = 3000): Promise<StatusEventRow[] | null> {
  const { data, error } = await supabase
    .from('doctor_status_events')
    .select('*')
    .gte('event_at', sinceIso)
    .order('event_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('Histórico de status indisponível:', error.message);
    return null;
  }
  return (data ?? []) as StatusEventRow[];
}
