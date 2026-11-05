/* ── Dias da semana ── */

const DAY_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

/** Transforma "seg,qua,ter" em ['seg','ter','qua'] */
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

/* ── Médico recente ── */

export function isRecentDoctor(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return created > cutoff;
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
