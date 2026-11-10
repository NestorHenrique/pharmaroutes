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

/** Grafia correta (com acento) das cidades mais comuns da base */
const CITY_NAMES = [
  'Água Branca', 'Parnaíba', 'Matias Olímpio', 'Angical do Piauí', 'Luís Correia', 'Cajueiro da Praia',
  'José de Freitas', 'União', 'São João da Fronteira', 'Nossa Senhora dos Remédios', 'Lagoa de São Francisco',
  'Capitão de Campos', 'Ilha Grande', 'Cocal dos Alves', 'São Miguel do Tapuio', 'Prata do Piauí',
  'Piracuruca', 'Pedro II', 'Buriti dos Lopes', 'Buriti dos Montes', 'Campo Maior', 'Domingos Mourão',
  'Joaquim Pires', 'Murici dos Portelas', 'São Pedro do Piauí', 'Santa Cruz dos Milagres', 'Jatobá do Piauí',
];
const CITY_BY_KEY = new Map(CITY_NAMES.map((n) => [cityKey(n), n]));
const LOWER_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** Nome de cidade para exibir: com acento (lista conhecida) e iniciais maiúsculas ("parnaiba" → "Parnaíba") */
export function prettyCity(name: string | null | undefined): string {
  const raw = (name || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const known = CITY_BY_KEY.get(cityKey(raw));
  if (known) return known;
  return raw
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (/^(ii|iii|iv|vi|vii|viii|ix)$/.test(w)) return w.toUpperCase();
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
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
  ubs: /\bubs\b|\bunidade basica\b/,
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

/* ── Cidades: "Parnaíba" e "Parnaiba" viram uma só ── */

export interface CityOption {
  /** chave sem acento (cityKey) */
  value: string;
  /** grafia exibida: a mais usada; em empate, a com acento */
  label: string;
  count: number;
}

export function buildCityOptions(names: (string | null | undefined)[]): CityOption[] {
  const groups = new Map<string, Map<string, number>>();
  for (const raw of names) {
    const name = (raw || '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = cityKey(name);
    const variants = groups.get(key) ?? new Map<string, number>();
    variants.set(name, (variants.get(name) ?? 0) + 1);
    groups.set(key, variants);
  }

  const options: CityOption[] = [];
  for (const [key, variants] of groups) {
    let best = '';
    let bestN = -1;
    let total = 0;
    for (const [name, n] of variants) {
      total += n;
      const accented = normalizeText(name) !== name.toLowerCase();
      const bestAccented = best ? normalizeText(best) !== best.toLowerCase() : false;
      if (n > bestN || (n === bestN && accented && !bestAccented)) {
        best = name;
        bestN = n;
      }
    }
    options.push({ value: key, label: best, count: total });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Grafia oficial da cidade, se já existir na base; senão o texto limpo */
export function canonicalCity(name: string | null | undefined, options: CityOption[]): string {
  const clean = (name || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const key = cityKey(clean);
  return options.find((o) => o.value === key)?.label ?? clean;
}

/* ── Rota: média móvel de horários ── */

const DAY_INDEX: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

/** Quantas ocorrências do mesmo dia da semana entram na média */
export const ROUTE_SAMPLES_SAME_DAY = 4;
/** Janela de histórico considerada */
export const ROUTE_HISTORY_DAYS = 28;
/** Sem histórico no mesmo dia da semana: usa a última semana inteira */
export const ROUTE_FALLBACK_DAYS = 7;

export interface ExpectedTime {
  /** minutos desde 00:00 */
  minutes: number;
  /** quantos dias entraram na média */
  samples: number;
  /** true = média do mesmo dia da semana; false = média da última semana */
  sameWeekday: boolean;
}

/**
 * Horário esperado de cada médico no dia `day` (seg..dom).
 * Para cada dia com registro pega o primeiro clique (início da janela de visita),
 * depois faz a média das últimas ocorrências do mesmo dia da semana.
 * Sem dados desse dia da semana, usa a média da última semana.
 */
export function computeExpectedTimes(
  events: { doctor_id: string; event_at: string }[],
  day: string,
  nowMs: number,
): Map<string, ExpectedTime> {
  const target = DAY_INDEX[day] ?? new Date(nowMs).getDay();
  const oldest = nowMs - ROUTE_HISTORY_DAYS * 86_400_000;

  // doctor → data → primeiro horário do dia
  const perDoctor = new Map<string, Map<string, { minutes: number; weekday: number; ts: number }>>();
  for (const e of events) {
    const d = new Date(e.event_at);
    const ts = d.getTime();
    if (Number.isNaN(ts) || ts < oldest || ts > nowMs) continue;
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const minutes = d.getHours() * 60 + d.getMinutes();
    const days = perDoctor.get(e.doctor_id) ?? new Map();
    const prev = days.get(dateKey);
    if (!prev || minutes < prev.minutes) days.set(dateKey, { minutes, weekday: d.getDay(), ts });
    perDoctor.set(e.doctor_id, days);
  }

  const result = new Map<string, ExpectedTime>();
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

  for (const [doctorId, days] of perDoctor) {
    const list = Array.from(days.values()).sort((a, b) => b.ts - a.ts);
    const same = list.filter((x) => x.weekday === target).slice(0, ROUTE_SAMPLES_SAME_DAY);
    if (same.length > 0) {
      result.set(doctorId, { minutes: avg(same.map((x) => x.minutes)), samples: same.length, sameWeekday: true });
      continue;
    }
    const recent = list.filter((x) => x.ts >= nowMs - ROUTE_FALLBACK_DAYS * 86_400_000);
    if (recent.length > 0) {
      result.set(doctorId, { minutes: avg(recent.map((x) => x.minutes)), samples: recent.length, sameWeekday: false });
    }
  }
  return result;
}

/** 845 → "14:05" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

/** Os dois WhatsApps do médico. Sem WhatsApp da clínica, o telefone cadastrado serve de reserva. */
export function doctorWhatsApps(doc: {
  whatsapp_medico?: string | null;
  whatsapp_clinica?: string | null;
  telefone?: string | null;
}): { medico: string | null; clinica: string | null } {
  return {
    medico: buildWhatsAppUrl(doc.whatsapp_medico),
    clinica: buildWhatsAppUrl(doc.whatsapp_clinica) ?? buildWhatsAppUrl(doc.telefone),
  };
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

/** Minutos inteiros desde `iso` (nunca negativo) */
export function elapsedMinutes(iso: string, nowMs: number = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / 60_000));
}

/** Tempo crescente dos status em atendimento: "há 4 min (às 14:05)" */
export function formatElapsed(iso: string, nowMs: number = Date.now()): string {
  const m = elapsedMinutes(iso, nowMs);
  const ago = m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
  return `${ago} (às ${formatTime(iso)})`;
}

/**
 * Auditoria da visita no card: "Visitado por Maria hoje às 10:30"
 * ou, se foi em outro dia, "Visitado por Maria em 05/11 às 10:30".
 */
export function formatVisitAudit(repName: string | null | undefined, iso: string, nowMs: number = Date.now()): string {
  const d = new Date(iso);
  const n = new Date(nowMs);
  const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  const when = sameDay ? 'hoje' : `em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  const who = repName?.trim() ? ` por ${repName.trim()}` : '';
  return `Visitado${who} ${when} às ${formatTime(iso)}`;
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


/** "CRM 8786/PI" (sem letras na frente do número) */
export function formatCrm(crm: string | null | undefined, uf?: string | null): string {
  const n = normalizeCrm(crm);
  if (!n) return '';
  const u = (uf || '').trim().toUpperCase();
  return `CRM ${n}${u ? `/${u}` : ''}`;
}

/** Especialidades em ordem alfabética (A–Z) para as listas de seleção */
export const SPECIALTY_LIST: { value: string; label: string; hint: string }[] = [...ESPECIALIDADES]
  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  .map((e) => ({ value: e.label, label: e.label, hint: e.code }));
