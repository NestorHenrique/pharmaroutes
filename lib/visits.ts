/**
 * Visitas do ciclo POR REPRESENTANTE (tabela doctor_visits: uma linha por médico e por usuário).
 * Funções puras: o estado fica em hooks/useVisits.ts.
 */

import type { DoctorVisit } from '@/types/doctor';
import type { DoctorStatus } from '@/types/status';

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

/** "Nestor Henrique" -> "Nestor H." (nome + inicial do último sobrenome); só o nome se não houver sobrenome */
export function shortName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
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

/* ── Quem está no consultório / quem visitou (tag do card e da ficha) ── */

export interface PresenceItem {
  key: string;
  kind: 'office' | 'visit';
  /** primeiro nome */
  name: string;
  /** ISO do momento (chegou / visitou) */
  at: string;
  isMe?: boolean;
  /** foto do representante (null = iniciais) */
  avatarUrl?: string | null;
  /** local onde foi marcado; só entra quando o médico tem mais de um local */
  locationName?: string | null;
}

/** "16:55" hoje; "10/11 16:55" em outro dia (visita do ciclo pode ser de dias atrás) */
export function shortWhen(iso: string, nowMs: number = Date.now()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date(nowMs).toDateString()) return time;
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${date} ${time}`;
}

/** "Arthur no consultório 16:50" / "Nestor visitou 10/11 16:55" */
export function presenceText(item: PresenceItem, nowMs?: number): string {
  const where = item.locationName ? ` · ${item.locationName}` : '';
  if (item.kind === 'office') return `${item.isMe ? 'Você' : item.name} · ${shortWhen(item.at, nowMs)}${where}`;
  return `${item.isMe ? 'Você' : item.name} visitou ${shortWhen(item.at, nowMs)}${where}`;
}

/**
 * Presença de representantes no médico: quem está no consultório agora (status ativo) e quem já visitou.
 * No consultório vem primeiro; depois as visitas, da mais recente para a mais antiga.
 */
export function presenceItems(
  statuses: readonly DoctorStatus[] | undefined,
  visitors: readonly Visitor[] | undefined,
  profiles?: Readonly<Record<string, PublicProfile>>,
  myId?: string | null,
  /** id do local (ou 'principal') → nome curto; só vem quando o médico tem mais de um local */
  locationNames?: Readonly<Record<string, string>>,
): PresenceItem[] {
  const out: PresenceItem[] = [];
  for (const s of statuses ?? []) {
    if (s.status_type === 'representante_no_consultorio') {
      const p = profiles?.[s.created_by];
      out.push({
        key: `o:${s.id}`,
        kind: 'office',
        name: shortName(p?.display_name?.trim() || s.rep_name?.trim() || 'Representante'),
        at: s.created_at,
        isMe: Boolean(myId) && s.created_by === myId,
        avatarUrl: p?.avatar_url ?? null,
        locationName: locationNames ? locationNames[s.location_id ?? 'principal'] ?? null : null,
      });
    }
  }
  const visits: PresenceItem[] = (visitors ?? []).map((v) => ({
    key: `v:${v.userId}`,
    kind: 'visit',
    name: shortName(v.name),
    at: v.visitedAt,
    isMe: v.isMe,
    avatarUrl: v.avatarUrl,
  }));
  // PSM/SAMU/Hospital: a visita do dia fica em doctor_statuses
  if (visits.length === 0) {
    for (const s of statuses ?? []) {
      if (s.status_type === 'visitado_hoje') {
        visits.push({
          key: `d:${s.id}`,
          kind: 'visit',
          name: shortName(profiles?.[s.created_by]?.display_name?.trim() || s.rep_name?.trim() || 'Representante'),
          at: s.created_at,
          isMe: Boolean(myId) && s.created_by === myId,
          avatarUrl: profiles?.[s.created_by]?.avatar_url ?? null,
        });
      }
    }
  }
  visits.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return [...out, ...visits];
}
