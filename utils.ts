import type { AgendaEntry, Doctor, Shift } from '@/types/doctor';
import { ESPECIALIDADES } from '@/constants';

/* ── Texto ── */

/** minúsculas, sem acento, sem espaços nas pontas */
export function normalizeText(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Chave de cidade usada nas inscrições de push ("Parnaíba" → "parnaiba") */
export function cityKey(city: string | null | undefined): string {
  return normalizeText(city).replace(/\s+/g, ' ');
}

/* ── Dias da semana ── */

export const DAY_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

const DAY_LABEL: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};

/** Transforma "seg,qua,ter" em ['seg','qua','ter'] */
export function parseDays(str: string | null | undefined): string[] {
  if (!str) return [];
  return str
    .split(/[,;]/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** Ordena dias cronologicamente (seg→dom) */
export function sortDays(days: string[]): string[] {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

/** Liga/desliga um dia na string */
export function toggleDay(str: string | null | undefined, day: string): string {
  const days = parseDays(str);
  const idx = days.indexOf(day);
  if (idx >= 0) days.splice(idx, 1);
  else days.push(day);
  return days.join(',');
}

/* ── Agenda granular (dia + turno) ── */

const SHIFTS: Shift[] = ['MANHA', 'TARDE', 'INTEGRAL', 'NOITE'];

export const SHIFT_LABEL: Record<Shift, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  INTEGRAL: 'Integral',
  NOITE: 'Noite',
};

/** Converte o turno antigo ("Manhã", "Tarde", "Manhã e Tarde") */
export function turnoToShift(turno: string | null | undefined): Shift {
  const t = normalizeText(turno);
  if (!t) return 'INTEGRAL';
  if ((t.includes('manha') && t.includes('tarde')) || t.includes('integral')) return 'INTEGRAL';
  if (t.startsWith('manha')) return 'MANHA';
  if (t.startsWith('tarde')) return 'TARDE';
  if (t.startsWith('noite')) return 'NOITE';
  return 'INTEGRAL';
}

export function sortAgenda(agenda: AgendaEntry[]): AgendaEntry[] {
  return [...agenda].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}

/**
 * Agenda do médico, sempre em ordem seg→dom.
 * Usa a coluna `agenda`; se vazia, deriva de dias_semana + turno (dados antigos).
 */
export function getAgenda(
  doc: Pick<Doctor, 'agenda' | 'dias_semana' | 'dia_semana' | 'turno'>,
): AgendaEntry[] {
  if (Array.isArray(doc.agenda) && doc.agenda.length > 0) {
    const seen = new Set<string>();
    const clean: AgendaEntry[] = [];
    for (const e of doc.agenda) {
      if (!e || !DAY_ORDER.includes(e.day) || seen.has(e.day)) continue;
      seen.add(e.day);
      clean.push({ day: e.day, shift: SHIFTS.includes(e.shift) ? e.shift : 'INTEGRAL' });
    }
    return sortAgenda(clean);
  }
  const shift = turnoToShift(doc.turno);
  const days = Array.from(new Set(parseDays(doc.dias_semana || doc.dia_semana))).filter((d) =>
    DAY_ORDER.includes(d),
  );
  return sortDays(days).map((day) => ({ day, shift }));
}

/** "seg,ter" para manter a coluna antiga dias_semana sincronizada */
export function agendaToDias(agenda: AgendaEntry[]): string {
  return sortAgenda(agenda).map((e) => e.day).join(',');
}

/** "Seg (Integral)" */
export function formatAgendaBadge(e: AgendaEntry): string {
  return `${DAY_LABEL[e.day] ?? e.day} (${SHIFT_LABEL[e.shift]})`;
}

export function dayLabel(day: string): string {
  return DAY_LABEL[day] ?? day;
}

/** O turno do dia cobre o filtro? Integral cobre manhã e tarde. */
export function shiftCovers(shift: Shift, filter: Shift): boolean {
  return shift === filter || (shift === 'INTEGRAL' && (filter === 'MANHA' || filter === 'TARDE'));
}

/* ── Especialidade ── */

/** Sigla padronizada (CAR, ANG, CLG...). Fallback: 3 primeiras letras. */
export function specialtyCode(esp: string | null | undefined): string | null {
  const raw = (esp || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (ESPECIALIDADES.some((e) => e.code === upper)) return upper;
  const n = normalizeText(raw);
  for (const e of ESPECIALIDADES) {
    if (e.keys.some((k) => n.includes(k))) return e.code;
  }
  const letters = n.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase();
  return letters || null;
}

export function specialtyLabel(code: string): string {
  return ESPECIALIDADES.find((e) => e.code === code)?.label ?? code;
}

/* ── Local de atuação (PSM / SAMU / Hospital) ──
 * Olha só a categoria e o campo de local (complemento). Nunca o nome do médico,
 * para "Samuel" ou "Sâmia" não caírem no filtro SAMU.
 */
const LOCATION_PATTERNS: Record<string, RegExp> = {
  psm: /\bpsm\b|\bpronto[\s-]*socorro\b/,
  samu: /\bsamu\b/,
  hospital: /\bhosp(ital)?\b/,
};

export function matchesLocation(doc: Pick<Doctor, 'categoria' | 'complemento'>, category: string): boolean {
  if (doc.categoria === category) return true;
  const re = LOCATION_PATTERNS[category];
  if (!re) return false;
  return re.test(normalizeText(doc.complemento));
}

/* ── CRM ── */

/** Só os dígitos do CRM ("CRM-PI 1.234" → "1234") */
export function normalizeCrm(crm: string | null | undefined): string {
  return (crm || '').replace(/\D/g, '');
}

/* ── Médico novo ── */

export function isRecentDoctor(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return created > cutoff;
}

/** NOVO = cadastrado em campo pelo app nos últimos 7 dias (importações não contam) */
export function isNewDoctor(doc: Pick<Doctor, 'created_via' | 'created_at'>): boolean {
  return doc.created_via === 'APP_FIELD' && isRecentDoctor(doc.created_at);
}

/* ── WhatsApp ── */

export function buildWhatsAppUrl(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let num = telefone.replace(/\D/g, '');
  if (!num) return null;
  if (!num.startsWith('55')) num = '55' + num;
  // Corrige zero depois do DDD (55 XX 0…)
  if (num.length === 13 && num[4] === '0') num = num.slice(0, 4) + num.slice(5);
  return `https://wa.me/${num}`;
}

/* ── Tempo relativo ── */

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `há ${days} dia${days > 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function minutesRemaining(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / 60_000);
}

/* ── Dia de hoje ── */

export function getTodayDayCode(): string {
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date().getDay()];
}

/* ── Form persistence helpers ── */

const FORM_PREFIX = 'pharma_form_';
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 h

export function hasSavedDraft(key: string): boolean {
  try {
    const raw = localStorage.getItem(FORM_PREFIX + key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?._ts && Date.now() - parsed._ts < MAX_AGE);
  } catch {
    return false;
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(FORM_PREFIX + key);
    if (!raw) return null;
    const { _ts, ...data } = JSON.parse(raw);
    if (!_ts || Date.now() - _ts >= MAX_AGE) {
      localStorage.removeItem(FORM_PREFIX + key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(FORM_PREFIX + key, JSON.stringify({ ...data, _ts: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(FORM_PREFIX + key);
  } catch { /* ignore */ }
}
