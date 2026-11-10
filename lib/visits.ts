/**
 * Visitas do ciclo POR REPRESENTANTE (tabela doctor_visits: uma linha por médico e por usuário).
 * Funções puras: o estado fica em hooks/useVisits.ts.
 */

import type { DoctorVisit } from '@/types/doctor';

export type VisitMap = Record<string, DoctorVisit[]>;

/** Nome e foto de um representante, como aparecem para os colegas */
export interface PublicProfile {
  display_name: string | null;
  avatar_url: string | null;
}

/** Quem visitou, já pronto para a tela */
export interface Visitor {
  userId: string;
  name: string;
  avatarUrl: string | null;
  visitedAt: string;
  isMe: boolean;
}

export function groupVisits(rows: readonly DoctorVisit[]): VisitMap {
  const map: VisitMap = {};
  for (const r of rows) (map[r.doctor_id] ||= []).push(r);
  return map;
}

export function upsertVisit(map: VisitMap, row: DoctorVisit): VisitMap {
  const others = (map[row.doctor_id] || []).filter((v) => v.user_id !== row.user_id);
  return { ...map, [row.doctor_id]: [...others, row] };
}

export function removeVisit(map: VisitMap, doctorId: string, userId: string): VisitMap {
  const list = map[doctorId];
  if (!list) return map;
  return { ...map, [doctorId]: list.filter((v) => v.user_id !== userId) };
}

/** "Renovar ciclo": some só o que é deste usuário */
export function clearUserVisits(map: VisitMap, userId: string): VisitMap {
  const out: VisitMap = {};
  for (const [docId, list] of Object.entries(map)) out[docId] = list.filter((v) => v.user_id !== userId);
  return out;
}

/** doctor_id -> visited_at das visitas deste usuário */
export function myVisitDates(map: VisitMap, userId: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!userId) return out;
  for (const [docId, list] of Object.entries(map)) {
    const mine = list.find((v) => v.user_id === userId);
    if (mine) out.set(docId, mine.visited_at);
  }
  return out;
}

/** Visitantes do médico: eu primeiro, depois os outros do mais recente para o mais antigo */
export function visitorsOf(
  list: readonly DoctorVisit[] | undefined,
  profiles: Readonly<Record<string, PublicProfile>>,
  myId: string | null,
): Visitor[] {
  if (!list?.length) return [];
  return list
    .map((v) => {
      const p = profiles[v.user_id];
      return {
        userId: v.user_id,
        name: p?.display_name?.trim() || v.rep_name?.trim() || 'Representante',
        avatarUrl: p?.avatar_url ?? null,
        visitedAt: v.visited_at,
        isMe: v.user_id === myId,
      };
    })
    .sort((a, b) => {
      if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
      return new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime();
    });
}

/** Primeiro nome para legendas curtas */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Iniciais para o avatar sem foto (até 2 letras) */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Texto curto: "Visitado por Nestor hoje às 08:18" (1) ou "Visitado por Nestor e mais 2" (vários) */
export function visitorsSummary(
  visitors: readonly Visitor[],
  format: (name: string, iso: string) => string,
): string | null {
  if (visitors.length === 0) return null;
  const [lead, ...rest] = visitors;
  if (rest.length === 0) return format(lead.name, lead.visitedAt);
  return `Visitado por ${firstName(lead.name)} e mais ${rest.length}`;
}
