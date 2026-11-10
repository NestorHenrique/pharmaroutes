/**
 * Fila offline. Sem internet, status, edições de médico e a ordem da rota são guardados
 * no aparelho (localStorage) e enviados ao Supabase quando a conexão volta.
 *
 * Regras:
 *  - cada operação pertence a um usuário (`owner`); cada um só envia as suas;
 *  - operações sobre o MESMO alvo se juntam (só vale a última): marcar e desmarcar o mesmo
 *    status offline vira uma operação só; várias edições do mesmo médico viram uma;
 *  - falha de rede = tenta de novo depois; recusa do servidor = descarta (senão trava a fila).
 *
 * Este arquivo não conhece o Supabase (quem envia é lib/offlineSync.ts).
 */

import type { DoctorStatusType } from '@/types/status';

const STORAGE_KEY = 'pharma_offline_queue_v1';
const CHANGE_EVENT = 'pharma-offline-queue';
/** Teto de segurança: passando disso descarta as mais antigas */
const MAX_OPS = 500;

/** Linha de doctor_statuses como o app grava */
export interface StatusRecord {
  doctor_id: string;
  status_type: DoctorStatusType;
  created_at: string;
  expires_at: string | null;
  return_date: string | null;
  rep_name: string | null;
  created_by: string;
}

/** Linha de doctor_visits como o app grava (uma por médico e por representante) */
export interface VisitRecord {
  doctor_id: string;
  user_id: string;
  rep_name: string | null;
  visited_at: string;
}

export type OpInput =
  | { kind: 'status_upsert'; record: StatusRecord }
  | { kind: 'status_delete'; doctor_id: string; status_type: DoctorStatusType }
  | { kind: 'visit_upsert'; record: VisitRecord }
  | { kind: 'visit_delete'; doctor_id: string }
  | { kind: 'visits_clear' }
  | { kind: 'doctor_update'; doctor_id: string; fields: Record<string, unknown> }
  | { kind: 'route_order'; day: string; doctor_ids: string[] };

export type QueuedOp = OpInput & { id: string; owner: string; at: number };

export type ExecResult = 'done' | 'retry' | 'drop';

/* ── Armazenamento ── */

function readAll(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is QueuedOp =>
        typeof o === 'object' &&
        o !== null &&
        typeof (o as QueuedOp).id === 'string' &&
        typeof (o as QueuedOp).owner === 'string' &&
        typeof (o as QueuedOp).kind === 'string',
    );
  } catch {
    return [];
  }
}

function writeAll(ops: QueuedOp[]): void {
  try {
    if (ops.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
  } catch {
    /* sem espaço ou modo privado: a fila só vale até fechar o app */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Junção de operações do mesmo alvo ── */

function targetKey(op: OpInput & { owner: string }): string {
  switch (op.kind) {
    case 'status_upsert':
      return `${op.owner}|s|${op.record.doctor_id}|${op.record.status_type}`;
    case 'status_delete':
      return `${op.owner}|s|${op.doctor_id}|${op.status_type}`;
    case 'visit_upsert':
      return `${op.owner}|v|${op.record.doctor_id}`;
    case 'visit_delete':
      return `${op.owner}|v|${op.doctor_id}`;
    case 'visits_clear':
      return `${op.owner}|vclear`;
    case 'doctor_update':
      return `${op.owner}|d|${op.doctor_id}`;
    case 'route_order':
      return `${op.owner}|r|${op.day}`;
  }
}

/** Junta `incoming` à fila: a mais nova substitui a antiga do mesmo alvo (edições de médico se somam) */
export function compactQueue(queue: readonly QueuedOp[], incoming: QueuedOp): QueuedOp[] {
  const key = targetKey(incoming);
  const previous = queue.find((q) => targetKey(q) === key);
  const rest = queue.filter((q) => q !== previous);
  let next = incoming;
  if (previous?.kind === 'doctor_update' && incoming.kind === 'doctor_update') {
    next = { ...incoming, fields: { ...previous.fields, ...incoming.fields } };
  }
  let kept = rest;
  // "Renovar ciclo" offline: visitas pendentes de antes da renovação não valem mais
  if (incoming.kind === 'visits_clear') {
    kept = rest.filter((q) => !(q.owner === incoming.owner && (q.kind === 'visit_upsert' || q.kind === 'visit_delete')));
  }
  const out = [...kept, next];
  return out.length > MAX_OPS ? out.slice(out.length - MAX_OPS) : out;
}

/* ── API ── */

export function enqueue(owner: string, input: OpInput): QueuedOp {
  const op = { ...input, id: newId(), owner, at: Date.now() } as QueuedOp;
  writeAll(compactQueue(readAll(), op));
  return op;
}

/** Operações pendentes de um usuário, da mais antiga para a mais nova */
export function pendingOps(owner: string): QueuedOp[] {
  return readAll()
    .filter((o) => o.owner === owner)
    .sort((a, b) => a.at - b.at);
}

export function removeOps(ids: readonly string[]): void {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  writeAll(readAll().filter((o) => !drop.has(o.id)));
}

/** Avisa quando a fila muda (nesta aba ou em outra) */
export function subscribeQueue(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

let flushing = false;

/**
 * Envia as pendências do usuário, uma a uma, na ordem. Para na primeira que pedir "retry"
 * (sem rede): o resto espera a próxima tentativa. Duas chamadas ao mesmo tempo não se atropelam.
 */
export async function flushQueue(
  owner: string,
  execute: (op: QueuedOp) => Promise<ExecResult>,
): Promise<{ sent: number; dropped: number; remaining: number }> {
  if (flushing) return { sent: 0, dropped: 0, remaining: pendingOps(owner).length };
  flushing = true;
  let sent = 0;
  let dropped = 0;
  try {
    for (const op of pendingOps(owner)) {
      const result = await execute(op);
      if (result === 'retry') break;
      removeOps([op.id]);
      if (result === 'done') sent++;
      else dropped++;
    }
  } finally {
    flushing = false;
  }
  return { sent, dropped, remaining: pendingOps(owner).length };
}

/* ── Erro de rede x recusa do servidor ── */

interface ErrorLike {
  message?: string;
  code?: string;
  name?: string;
}

const NETWORK_MESSAGE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error|timeout|timed out|aborted|offline/i;

/**
 * true = a requisição nem chegou ao servidor (ou o gateway caiu) e vale tentar de novo.
 * Erros do banco (RLS, chave duplicada, coluna inexistente...) trazem `code` e NÃO contam.
 * `status` é o HTTP devolvido pelo supabase-js (0 = a rede falhou).
 */
export function isNetworkError(error: ErrorLike | null | undefined, status?: number, onLine?: boolean): boolean {
  if (!error) return false;
  if (onLine === false) return true;
  if (status === 0 || status === 502 || status === 503 || status === 504) return true;
  if (error.code) return false;
  return NETWORK_MESSAGE.test(`${error.name ?? ''} ${error.message ?? ''}`);
}

/** O aparelho se diz sem internet? (navigator.onLine === false é confiável; true não garante nada) */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
