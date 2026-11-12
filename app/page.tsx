'use client';

import { Component, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AddDoctorResult, Doctor, Shift } from '@/types/doctor';
import {
  ROUTE_EVENT_STATUSES,
  CYCLE_WEEKS,
  CYCLE_VISIT_STATUS,
  cycleWeekKey,
  cycleWeekLabel,
  normalizeCycleWeeks,
} from '@/types/doctor';
import type { CycleWeek, RouteTier } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusEvent, DoctorStatusType } from '@/types/status';
import { STATUS_META, PINNED_STATUSES } from '@/types/status';
import { TABS_NAVEGACAO, FILTROS_PLANTAO, FILTROS_TURNO, OPCOES_DIAS } from '@/constants';
import {
  agendaToDias,
  buildCityOptions,
  canonicalCity,
  cityKey,
  formatMinutes,
  formatTime,
  formatVisitAudit,
  getAgenda,
  getTodayDayCode,
  isNewDoctor,
  matchesLocation,
  normalizeCrm,
  prettyCity,
  shiftCovers,
  specialtyCode,
  ROUTE_HISTORY_DAYS,
} from '@/utils';
import { ensureServiceWorker, getPushSupport, notifyCity, subscribeToCity, unsubscribePush } from '@/lib/push';
import { enqueue, isNetworkError, isOffline, pendingOps } from '@/lib/offlineQueue';
import type { QueuedOp } from '@/lib/offlineQueue';

import LoginScreen from '@/components/LoginScreen';
import InstallBanner from '@/components/InstallBanner';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useRepProfile } from '@/hooks/useRepProfile';
import { useDoctorFilters } from '@/hooks/useDoctorFilters';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useVisits } from '@/hooks/useVisits';
import { useVisitPrompts } from '@/hooks/useVisitPrompts';
import VisitPromptModal from '@/components/VisitPromptModal';
import NameConfirmSheet, { suggestName } from '@/components/NameConfirmSheet';
import WeekSetupFlow from '@/components/WeekSetupFlow';
import ConfirmSheet from '@/components/ConfirmSheet';
import Tour from '@/components/Tour';
import StatusGuide from '@/components/StatusGuide';
import { useWeekCities } from '@/hooks/useWeekCities';
import { getFlag, setFlag } from '@/lib/repFlags';
import { alreadyVisited, roundLabel, type VisitPrompt } from '@/lib/visitPrompts';
import { presenceItems, visitorsOf, visitorsSummary } from '@/lib/visits';
import { matchDoctor, SEARCH_SCOPES } from '@/lib/search';
import type { SearchScope } from '@/lib/search';
import type { PresenceItem, Visitor } from '@/lib/visits';
import PresenceTags from '@/components/PresenceTags';
import type { SortMode } from '@/hooks/useDoctorFilters';
import DoctorCard from '@/components/DoctorCard';
import DoctorSheet from '@/components/DoctorSheet';
import { RepAvatar } from '@/components/RepAvatar';
import AddDoctorForm from '@/components/AddDoctorForm';
import BottomSheet from '@/components/BottomSheet';
import { mergeVisibleOrder } from '@/lib/routeOrder';
import StatusOverview from '@/components/StatusOverview';
import ProfileSheet from '@/components/ProfileSheet';
import EditProfileSheet from '@/components/EditProfileSheet';
import { applyTheme, readThemePref, resolveTheme, type Theme, type ThemePref } from '@/lib/theme';
import CityFilter from '@/components/CityFilter';
import type { ComboOption } from '@/components/ComboBox';

/* ── Helpers ── */

/** Reserva com Realtime conectado (só para garantir consistência) */
const FALLBACK_POLL_MS = 60_000;
/** Reserva com Realtime fora do ar: atualiza bem mais rápido */
const OFFLINE_POLL_MS = 8_000;
/** Relógio da tela: some com status vencidos sem esperar o servidor */
const CLOCK_TICK_MS = 15_000;
const DUPLICATE_MSG = 'Médico já cadastrado na base de dados';
const SORT_MODE_KEY = 'pharma_sort_mode';
const CYCLE_WEEK_KEY = 'pharma_cycle_week';
const ACTIVE_WEEK_KEY = 'pharma_active_week';
const BOTTOM_OPEN_KEY = 'pharma_bottom_open';
const UNAVAILABLE_OPEN_KEY = 'pharma_unavailable_open';
const ROUTE_CLOSED_KEY = 'pharma_route_closed';

/** No estado contraído cada sub-lista de "Em atendimento" mostra só os mais recentes */
const COLLAPSED_VISIBLE = 2;

/** Segunda-feira da semana de `d` (YYYY-MM-DD, horário local): a semana vira à 00:00 de segunda */
function mondayOf(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Semana ativa salva no aparelho: { week, monday }. Formato antigo (só o número) conta como vencido. */
function readActiveWeek(): { week: CycleWeek; monday: string } | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WEEK_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'number') {
      const week = normalizeCycleWeeks([parsed])[0];
      return week ? { week, monday: '' } : null;
    }
    if (parsed && typeof parsed === 'object') {
      const o = parsed as { week?: unknown; monday?: unknown };
      const week = normalizeCycleWeeks([Number(o.week)])[0];
      if (week && typeof o.monday === 'string') return { week, monday: o.monday };
    }
  } catch { /* ignore */ }
  return null;
}

/** O PostgREST reclama de coluna que ainda não existe (migração pendente): PGRST204 */
function isMissingColumn(error: { code?: string; message?: string }, column: string): boolean {
  return (error.code === 'PGRST204' || /column/i.test(error.message ?? '')) && (error.message ?? '').includes(column);
}

function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function addMinutes(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function initialTab(): string | null {
  const today = getTodayDayCode();
  return OPCOES_DIAS.some((d) => d.value === today) ? today : null;
}

const NO_VISITORS: Visitor[] = [];

/** Nome do dia para frases ("na terça") */
const DAY_LONG: Record<string, string> = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta' };

/**
 * Licença/Viagem ficam marcadas até o DIA ANTES da volta (no dia da volta o médico já está de volta).
 * Devolve o fim desse período (23:59:59 do dia anterior à volta) ou null se não há data de retorno.
 */
function absenceEndMs(returnDate: string | null | undefined): number | null {
  if (!returnDate) return null;
  const d = new Date(`${returnDate}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 1);
  return d.getTime();
}

function isLive(
  s: Pick<DoctorStatus, 'expires_at'> & Partial<Pick<DoctorStatus, 'status_type' | 'return_date'>>,
  nowMs: number,
): boolean {
  // Também vale para Licença/Viagem já salvas com vencimento no dia da volta
  if (s.status_type === 'ferias' || s.status_type === 'viajando') {
    const end = absenceEndMs(s.return_date);
    if (end !== null) return end > nowMs;
  }
  return !s.expires_at || new Date(s.expires_at).getTime() > nowMs;
}

/** Status marcados sem internet que ainda não subiram: continuam na tela mesmo após recarregar */
function overlayPendingStatuses(map: Record<string, DoctorStatus[]>, owner: string): Record<string, DoctorStatus[]> {
  let out = map;
  for (const op of pendingOps(owner)) {
    if (op.kind === 'status_upsert') {
      out = upsertStatus(out, { id: `pending-${op.id}`, ...op.record });
    } else if (op.kind === 'status_delete') {
      out = { ...out, [op.doctor_id]: (out[op.doctor_id] || []).filter((s) => s.status_type !== op.status_type) };
    }
  }
  return out;
}

/** Edições de médico feitas sem internet por cima da lista que veio do servidor */
function overlayPendingDoctors(list: Doctor[], owner: string): Doctor[] {
  const edits = new Map<string, Partial<Doctor>>();
  for (const op of pendingOps(owner) as QueuedOp[]) {
    if (op.kind === 'doctor_update') edits.set(op.doctor_id, op.fields as Partial<Doctor>);
  }
  if (edits.size === 0) return list;
  return list.map((d) => (edits.has(d.id) ? { ...d, ...edits.get(d.id) } : d));
}

/* Última lista de médicos que o servidor mandou: o app abre na hora e também sem sinal */
const DOCTORS_CACHE_KEY = 'pharma_doctors_cache_v1';

function saveDoctorsCache(owner: string, list: Doctor[]): void {
  try {
    localStorage.setItem(DOCTORS_CACHE_KEY, JSON.stringify({ owner, list }));
  } catch { /* sem espaço: segue sem cache */ }
}

function loadDoctorsCache(owner: string): Doctor[] | null {
  try {
    const raw = localStorage.getItem(DOCTORS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { owner?: string; list?: Doctor[] };
    return parsed.owner === owner && Array.isArray(parsed.list) ? parsed.list : null;
  } catch {
    return null;
  }
}

function clearDoctorsCache(): void {
  try {
    localStorage.removeItem(DOCTORS_CACHE_KEY);
  } catch { /* ignore */ }
}

/** Insere ou troca o status (um por médico + tipo) */
function upsertStatus(map: Record<string, DoctorStatus[]>, s: DoctorStatus): Record<string, DoctorStatus[]> {
  const others = (map[s.doctor_id] || []).filter((x) => x.status_type !== s.status_type);
  return { ...map, [s.doctor_id]: [...others, s] };
}

/** Ordem exata dentro do bloco do topo */
const TOP_ORDER: DoctorStatusType[] = ['representante_no_consultorio', 'ultimo_paciente', 'aguardando_medico'];

/**
 * Se algo quebrar no feed (ex.: estado suspenso pelo WebKit em segundo plano),
 * mostra um aviso com "Tentar de novo" em vez de deixar a tela em branco.
 * `resetKey` muda a cada retomada do app: o feed tenta se recuperar sozinho.
 */
class FeedErrorBoundary extends Component<{ resetKey: number; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro no feed:', error.message, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: number }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-4 text-center">
        <span className="text-sm text-slate-200">A lista não carregou direito.</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
          >
            Recarregar app
          </button>
        </div>
      </div>
    );
  }
}

/** Mesmo modelo dos títulos do cadastro (FormTitle): barrinha + texto forte. Sem `tone` usa a cor de destaque do tema. */
function SectionTitle({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <div className={`mt-2 flex items-center gap-2 ${tone ?? 'text-blue-400'}`}>
      <span className={`h-4 w-1 shrink-0 rounded-full ${tone ? 'bg-current' : 'bg-blue-600'}`} aria-hidden="true" />
      <span className="text-[13px] font-bold uppercase tracking-[0.1em]">{children}</span>
    </div>
  );
}

/** Título de lista que recolhe/expande (setinha + contador). `onToggle` ausente = título fixo. */
function CollapsibleTitle({
  tone,
  title,
  count,
  open,
  onToggle,
  hint,
  variant,
}: {
  tone?: string;
  title: string;
  count: number;
  open: boolean;
  onToggle?: () => void;
  hint?: string;
  /** "visited": linha recolhida verde (check + contagem), como no desenho */
  variant?: 'visited';
}) {
  if (variant === 'visited' && onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mt-2 flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 text-left"
      >
        <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-emerald-500 text-slate-950">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        <span className="flex-1 text-sm font-semibold text-emerald-400">{title}</span>
        <span className="grid h-[26px] min-w-[26px] place-items-center rounded-full bg-emerald-500/20 px-2 text-[13px] font-bold text-emerald-400">
          {count}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-emerald-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    );
  }
  const label = (
    <>
      {title} ({count})
    </>
  );
  if (!onToggle) return <SectionTitle tone={tone}>{label}</SectionTitle>;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`mt-2 flex w-full items-center justify-between gap-2 border-0 bg-transparent p-0 text-left ${tone ?? 'text-blue-400'}`}
    >
      <span className="flex items-center gap-2">
        <span className={`h-4 w-1 shrink-0 rounded-full ${tone ? 'bg-current' : 'bg-blue-600'}`} aria-hidden="true" />
        <span className="text-[13px] font-bold uppercase tracking-[0.1em]">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-slate-500">
        {hint}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={open ? 'rotate-180' : ''}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}

/** Sub-listas de "Em atendimento", na ordem de prioridade (igual a TOP_ORDER) */
const ATTENDANCE_GROUPS: { type: DoctorStatusType; title: string; tone: string }[] = [
  { type: 'representante_no_consultorio', title: 'Representante no consultório', tone: 'text-sky-400' },
  { type: 'ultimo_paciente', title: 'Último paciente', tone: 'text-red-400' },
  { type: 'aguardando_medico', title: 'Aguardando médico', tone: 'text-amber-400' },
];

/** Abre Maps/WhatsApp fora do app sem descarregar o PWA (ver DoctorCard.openExternal) */
function openExternal(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Link de navegação do médico: GPS fixo, senão rota pelo endereço */
function navigationUrl(d: Doctor): string | null {
  const link = d.map_link?.trim();
  if (link) return link;
  if (!d.endereco) return null;
  const address = [[d.endereco, d.numero || 'SN'].join(', '), d.bairro, d.cidade].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

const iconBtn =
  'size-10 shrink-0 rounded-full border border-slate-800 bg-slate-900 text-slate-200 flex items-center justify-center hover:text-white';

/* ── Page Component ── */

export default function HomePage() {
  /* Auth */
  const [session, setSession] = useState<{ access_token?: string; user: { id: string; email?: string } } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Data */
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, DoctorStatus[]>>({});
  const [events, setEvents] = useState<DoctorStatusEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [realtimeOn, setRealtimeOn] = useState(false);

  /* Filters */
  const [selectedTab, setSelectedTab] = useState<string | null>(initialTab);
  const [turnoFilter, setTurnoFilter] = useState<Shift | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('tudo');
  const [searchFocus, setSearchFocus] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  /** null = Todas as semanas do ciclo */
  const [selectedWeek, setSelectedWeek] = useState<CycleWeek | null>(null);
  /** "Estou visitando na": semana em que os visitados entram automaticamente */
  const [activeWeek, setActiveWeek] = useState<CycleWeek | null>(null);
  /** pergunta da semana (abre no início de cada semana) e a semana da semana passada */
  const [weekPrompt, setWeekPrompt] = useState(false);
  /** o fluxo da semana abriu sozinho (primeiro acesso da semana): só aí valem os avisos de ciclo */
  const [weekAuto, setWeekAuto] = useState(false);
  /** confirmação "Começar um novo ciclo?" (com o que fazer depois de confirmar) */
  const [renewAsk, setRenewAsk] = useState<{ then?: () => void } | null>(null);
  const [renewBusy, setRenewBusy] = useState(false);
  /** tutorial da tela inicial e guia de cores */
  const [tourOpen, setTourOpen] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  /** Filtros > Avisos da semana: salvar as cidades escolhidas na semana (ligado) ou só olhar (desligado) */
  const [weekSave, setWeekSave] = useState(true);
  const [weekTemp, setWeekTemp] = useState<string[] | null>(null);
  const [lastWeek, setLastWeek] = useState<CycleWeek | null>(null);

  /* UI */
  /** "Visitados e indisponíveis" começa recolhida; a escolha fica salva no aparelho */
  const [bottomOpen, setBottomOpen] = useState(false);
  const [unavailOpen, setUnavailOpen] = useState(false);
  /** "Rota" começa expandida; se o usuário recolher, a escolha fica salva no aparelho */
  const [routeClosed, setRouteClosed] = useState(false);
  /** sub-listas de "Em atendimento" abertas por inteiro (as demais mostram só as mais recentes) */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  /* PWA install */
  const install = useInstallPrompt();

  /* Perfil / carteira / ordem manual */
  const userId = session?.user.id ?? null;
  const { profile, portfolio, saveProfile, linkDoctor, routeOrder, saveRouteOrder } = useRepProfile(userId);
  const actorName = profile?.display_name?.trim() || session?.user.email?.split('@')[0] || 'App';
  /** cidades de cada semana (avisos); não escondem médicos */
  const weekCities = useWeekCities(userId);

  /* Primeiro acesso: "Confirme como os colegas te chamam". Fechar sem confirmar = pergunta de novo na próxima abertura. */
  const [nameLater, setNameLater] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const nameConfirmed = Boolean(profile?.name_confirmed_at) || (userId ? getFlag(userId, 'name-confirmed') === '1' : false);
  const needName = Boolean(userId && profile && !nameConfirmed && !nameLater);
  const confirmName = async (fullName: string) => {
    if (!userId) return;
    setNameSaving(true);
    setFlag(userId, 'name-confirmed', '1'); // reserva: sem a coluna v12 a pergunta não pode repetir
    const ok = await saveProfile({ display_name: fullName, name_confirmed_at: new Date().toISOString() });
    if (!ok) setFlag(userId, 'name-confirmed', null);
    setNameSaving(false);
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ═══════════════════ Auth ═══════════════════ */

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  /* Aparência: Escuro (Ônix), Claro (Marfim) ou Automático. O layout já aplicou o salvo antes da pintura. */
  const [themePref, setThemePref] = useState<ThemePref>('onix');
  const [theme, setTheme] = useState<Theme>('onix');
  useEffect(() => {
    const pref = readThemePref();
    setThemePref(pref);
    setTheme(resolveTheme(pref));
  }, []);
  const changeTheme = (pref: ThemePref) => {
    setThemePref(pref);
    setTheme(applyTheme(pref));
  };
  // Automático: acompanha o aparelho enquanto o app está aberto
  useEffect(() => {
    if (themePref !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setTheme(applyTheme('auto'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themePref]);

  /* App pronto: avisa o script de recuperação do layout (tela branca no iOS) */
  useEffect(() => {
    document.documentElement.setAttribute('data-app-ready', '1');
    document.getElementById('pwa-recover')?.remove();
  }, []);

  /* Service worker de push sempre atualizado + modo de ordenação salvo no aparelho */
  useEffect(() => {
    ensureServiceWorker();
    try {
      const saved = localStorage.getItem(SORT_MODE_KEY);
      if (saved === 'historico' || saved === 'manual') setSortMode(saved);
      if (localStorage.getItem(BOTTOM_OPEN_KEY) === '1') setBottomOpen(true);
      if (localStorage.getItem(UNAVAILABLE_OPEN_KEY) === '1') setUnavailOpen(true);
      if (localStorage.getItem(ROUTE_CLOSED_KEY) === '1') setRouteClosed(true);
      const week = normalizeCycleWeeks([Number(localStorage.getItem(CYCLE_WEEK_KEY))])[0];
      if (week) setSelectedWeek(week);
      // Semana ativa vale até a próxima segunda-feira; depois pergunta de novo
      const savedWeek = readActiveWeek();
      if (savedWeek && savedWeek.monday === mondayOf()) setActiveWeek(savedWeek.week);
      else {
        if (savedWeek) setLastWeek(savedWeek.week);
        setWeekAuto(true);
        setWeekPrompt(true);
      }
    } catch { /* ignore */ }
  }, []);

  const changeActiveWeek = (week: CycleWeek | null) => {
    setActiveWeek(week);
    try {
      if (week) localStorage.setItem(ACTIVE_WEEK_KEY, JSON.stringify({ week, monday: mondayOf() }));
      else localStorage.removeItem(ACTIVE_WEEK_KEY);
    } catch { /* ignore */ }
    // Cópia no servidor: é por ela que a função de avisos escolhe as cidades da semana
    void saveProfile({ active_week: week, active_week_monday: week ? mondayOf() : null });
  };

  /** Escolheu a semana: guarda e passa a mostrar só os médicos marcados nela */
  const pickWeek = (week: CycleWeek) => {
    changeActiveWeek(week);
    changeWeek(week);
  };

  // Outro aparelho já respondeu "qual semana" nesta segunda-feira: segue a mesma
  useEffect(() => {
    if (!profile || activeWeek) return;
    const w = normalizeCycleWeeks([Number(profile.active_week)])[0];
    if (w && profile.active_week_monday === mondayOf()) {
      setActiveWeek(w);
      setWeekPrompt(false);
      setWeekAuto(false);
      try {
        localStorage.setItem(ACTIVE_WEEK_KEY, JSON.stringify({ week: w, monday: mondayOf() }));
      } catch { /* ignore */ }
    }
  }, [profile, activeWeek]);

  // App aberto na virada da semana: na segunda-feira a semana escolhida expira
  useEffect(() => {
    if (!activeWeek) return;
    const saved = readActiveWeek();
    if (saved && saved.monday !== mondayOf()) {
      setLastWeek(saved.week);
      setActiveWeek(null);
      setWeekAuto(true);
      setWeekPrompt(true);
    }
  }, [now, activeWeek]);

  const changeWeek = (week: CycleWeek | null) => {
    setSelectedWeek(week);
    try {
      if (week) localStorage.setItem(CYCLE_WEEK_KEY, String(week));
      else localStorage.removeItem(CYCLE_WEEK_KEY);
    } catch { /* ignore */ }
  };

  const toggleBottomOpen = () => {
    const next = !bottomOpen;
    setBottomOpen(next);
    try {
      localStorage.setItem(BOTTOM_OPEN_KEY, next ? '1' : '0');
    } catch { /* ignore */ }
  };

  const toggleUnavailOpen = () => {
    const next = !unavailOpen;
    setUnavailOpen(next);
    try {
      localStorage.setItem(UNAVAILABLE_OPEN_KEY, next ? '1' : '0');
    } catch { /* ignore */ }
  };

  const toggleRouteClosed = () => {
    const next = !routeClosed;
    setRouteClosed(next);
    try {
      localStorage.setItem(ROUTE_CLOSED_KEY, next ? '1' : '0');
    } catch { /* ignore */ }
  };

  const changeSortMode = (mode: SortMode) => {
    setSortMode(mode);
    try {
      localStorage.setItem(SORT_MODE_KEY, mode);
    } catch { /* ignore */ }
  };

  /* ═══════════════════ Fetch Doctors ═══════════════════ */

  const fetchDoctors = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('descricao', { ascending: true });

      if (error) {
        console.error('Erro ao buscar médicos:', error.message, '|', error.details, '|', error.hint, '|', error.code);
      } else {
        saveDoctorsCache(session.user.id, data as Doctor[]);
        setDoctors(overlayPendingDoctors(data as Doctor[], session.user.id));
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Abre já com a última lista salva (e funciona sem sinal); a busca acima atualiza em seguida
  useEffect(() => {
    if (!userId) return;
    const cached = loadDoctorsCache(userId);
    if (cached?.length) setDoctors((prev) => (prev.length ? prev : overlayPendingDoctors(cached, userId)));
  }, [userId]);

  /* ═══════════════════ Statuses: Realtime + reserva ═══════════════════ */

  const fetchStatuses = useCallback(async () => {
    if (!session) return;
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('doctor_statuses')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    setNow(Date.now());
    if (error) {
      console.warn('Status fetch ignorado:', error.message || error.code);
      return;
    }
    const map: Record<string, DoctorStatus[]> = {};
    for (const s of data as DoctorStatus[]) {
      if (!map[s.doctor_id]) map[s.doctor_id] = [];
      map[s.doctor_id].push(s);
    }
    setStatusMap(overlayPendingStatuses(map, session.user.id));
  }, [session]);

  // Histórico para a média móvel
  const fetchEvents = useCallback(async () => {
    if (!session) return;
    const since = new Date(Date.now() - ROUTE_HISTORY_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from('doctor_status_events')
      .select('doctor_id, status_type, event_at')
      .in('status_type', ROUTE_EVENT_STATUSES)
      .gte('event_at', since)
      .order('event_at', { ascending: false })
      .limit(5000);
    if (error) {
      console.warn('Histórico indisponível:', error.message);
      return;
    }
    setEvents(data as DoctorStatusEvent[]);
  }, [session]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime: qualquer mudança em doctor_statuses chega em ~1 s para todos
  const accessToken = session?.access_token ?? null;
  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    if (!sessionUserId) return;

    // A policy da tabela libera só usuários logados ("authenticated").
    // Se o WebSocket conectar com a chave anônima, o Supabase descarta todos os
    // eventos em silêncio e o app cai na busca de reserva (o atraso de ~60 s).
    // Por isso o token da sessão é entregue ao Realtime antes de assinar.
    if (accessToken) void supabase.realtime.setAuth(accessToken);

    const applyChange = (payload: RealtimePostgresChangesPayload<DoctorStatus>) => {
      if (payload.eventType === 'DELETE') {
        const old = payload.old as Partial<DoctorStatus>;
        setStatusMap((prev) => {
          const next: Record<string, DoctorStatus[]> = {};
          for (const [docId, list] of Object.entries(prev)) {
            next[docId] = list.filter((s) =>
              old.doctor_id && old.status_type
                ? !(s.doctor_id === old.doctor_id && s.status_type === old.status_type)
                : s.id !== old.id,
            );
          }
          return next;
        });
        return;
      }

      const row = payload.new as DoctorStatus;
      if (!row?.doctor_id) return;
      // Atualiza a lista na hora; a ordenação (useMemo) reage e o card sobe para o topo
      setStatusMap((prev) => upsertStatus(prev, row));
      setNow(Date.now());
      if (ROUTE_EVENT_STATUSES.includes(row.status_type)) {
        setEvents((prev) => [
          { doctor_id: row.doctor_id, status_type: row.status_type, event_at: row.created_at },
          ...prev,
        ]);
      }
    };

    const channel = supabase
      .channel(`doctor-status-changes-${sessionUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_statuses' }, applyChange)
      .subscribe((state: string, err?: Error) => {
        setRealtimeOn(state === 'SUBSCRIBED');
        if (state === 'SUBSCRIBED') {
          // Sincroniza o que mudou enquanto estava desconectado (app em segundo plano no iOS)
          fetchStatuses();
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          console.warn('Realtime indisponível:', state, err?.message ?? '');
        }
      });

    return () => {
      setRealtimeOn(false);
      supabase.removeChannel(channel);
    };
  }, [sessionUserId, accessToken, fetchStatuses]);

  // Reserva: 60 s com Realtime conectado, 8 s sem ele; e sempre ao voltar para o app
  useEffect(() => {
    fetchStatuses();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchStatuses, realtimeOn ? FALLBACK_POLL_MS : OFFLINE_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchStatuses();
        fetchEvents();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchStatuses, fetchEvents, realtimeOn]);

  /* Retomada do app (volta do Google Maps/WhatsApp no iOS standalone):
   * força um novo render, sincroniza os dados e dá nova chance ao feed se ele tinha quebrado. */
  const [resumeTick, setResumeTick] = useState(0);
  const doctorsEmpty = doctors.length === 0;
  useEffect(() => {
    const onResume = (e?: Event) => {
      if (document.visibilityState !== 'visible') return;
      if (e?.type === 'pageshow' && !(e as PageTransitionEvent).persisted) return;
      setNow(Date.now());
      setResumeTick((t) => t + 1);
      fetchStatuses();
      fetchEvents();
      if (doctorsEmpty) fetchDoctors();
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [fetchStatuses, fetchEvents, fetchDoctors, doctorsEmpty]);

  // Relógio da tela (status de 10/20/30 min somem no horário certo)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, []);

  /* ═══════════════════ Modo offline: fila + sincronização ═══════════════════ */

  /* Visitas do ciclo: cada representante tem as suas */
  const { ready: visitsReady, visitMap, profiles: repProfiles, myVisits, markVisited, undoVisited, renewMine, refetchVisits } = useVisits(
    userId,
    accessToken,
    actorName,
  );
  /* "Já visitou?": status meu que venceu e ainda não respondi */
  const { pending: rawPrompts, resolve: resolvePrompt } = useVisitPrompts(userId);

  const offline = useOfflineQueue(
    userId,
    useCallback(() => {
      fetchStatuses();
      fetchDoctors();
      fetchEvents();
      void refetchVisits();
    }, [fetchStatuses, fetchDoctors, fetchEvents, refetchVisits]),
  );

  /* ═══════════════════ Status Actions (otimistas) ═══════════════════ */

  const setDoctorStatus = useCallback(
    async (
      doctorId: string,
      type: DoctorStatusType,
      opts?: { repName?: string; returnDate?: string; persistent?: boolean },
    ) => {
      if (!session) return;
      const meta = STATUS_META[type];

      let expiresAt: string | null = null;
      if (opts?.persistent) expiresAt = null; // visita do ciclo: fica até "Renovar Ciclo"
      else if (meta.duration) expiresAt = addMinutes(meta.duration);
      else if (meta.untilMidnight) expiresAt = endOfToday();
      else if (opts?.returnDate) {
        // Licença/Viagem: marcada até o dia antes da volta (se a volta é hoje ou antes, vale só hoje)
        const end = absenceEndMs(opts.returnDate);
        expiresAt = end !== null && end > Date.now() ? new Date(end).toISOString() : endOfToday();
      }

      const createdAt = new Date().toISOString();
      const record = {
        doctor_id: doctorId,
        status_type: type,
        // created_at explícito: ao remarcar, o horário precisa renovar
        created_at: createdAt,
        expires_at: expiresAt,
        return_date: opts?.returnDate || null,
        rep_name: opts?.repName || actorName,
        created_by: session.user.id,
      };

      // 1) Tela atualiza na hora
      const optimistic: DoctorStatus = { id: crypto.randomUUID(), ...record };
      const previous = (statusMap[doctorId] || []).find((s) => s.status_type === type);
      setStatusMap((prev) => upsertStatus(prev, optimistic));
      setNow(Date.now());
      if (ROUTE_EVENT_STATUSES.includes(type)) {
        setEvents((prev) => [{ doctor_id: doctorId, status_type: type, event_at: createdAt }, ...prev]);
      }

      // Sem internet: guarda no aparelho e envia quando a conexão voltar (a tela já mostra o status)
      const queue = () => enqueue(session.user.id, { kind: 'status_upsert', record });
      if (isOffline()) {
        queue();
        return;
      }

      // 2) Grava; o Realtime avisa os outros aparelhos
      const { error, status } = await supabase
        .from('doctor_statuses')
        .upsert(record, { onConflict: 'doctor_id,status_type' });

      if (error) {
        if (isNetworkError(error, status)) {
          queue(); // a rede falhou no meio: não desfaz, tenta de novo depois
          return;
        }
        console.error('Erro ao setar status:', error.message, '|', error.details, '|', error.hint, '|', error.code);
        setStatusMap((prev) => {
          const others = (prev[doctorId] || []).filter((s) => s.id !== optimistic.id);
          return { ...prev, [doctorId]: previous ? [...others, previous] : others };
        });
        return;
      }

      if (PINNED_STATUSES.includes(type)) notifyCity(doctorId, type);
    },
    [session, actorName, statusMap],
  );

  const clearDoctorStatus = useCallback(
    async (doctorId: string, type: DoctorStatusType) => {
      const previous = (statusMap[doctorId] || []).find((s) => s.status_type === type);
      setStatusMap((prev) => ({
        ...prev,
        [doctorId]: (prev[doctorId] || []).filter((s) => s.status_type !== type),
      }));

      const queue = () => {
        if (userId) enqueue(userId, { kind: 'status_delete', doctor_id: doctorId, status_type: type });
      };
      if (isOffline()) {
        queue();
        return;
      }

      const { error, status } = await supabase
        .from('doctor_statuses')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('status_type', type);

      if (error) {
        if (isNetworkError(error, status)) {
          queue();
          return;
        }
        console.error('Erro ao limpar status:', error.message, '|', error.details, '|', error.hint, '|', error.code);
        if (previous) setStatusMap((prev) => upsertStatus(prev, previous));
      }
    },
    [statusMap, userId],
  );

  /** Marcou "Visitado": o atendimento acabou, então tira Rep. no consultório / Último paciente / Aguardando */
  const clearAttendanceStatuses = useCallback(
    (doctorId: string) => {
      const active = statusMap[doctorId] || [];
      for (const type of TOP_ORDER) {
        if (active.some((s) => s.status_type === type)) void clearDoctorStatus(doctorId, type);
      }
    },
    [statusMap, clearDoctorStatus],
  );

  /* ═══════════════════ Cidades ═══════════════════ */

  const cityOptions = useMemo(() => buildCityOptions(doctors.map((d) => d.cidade)), [doctors]);
  const cityComboOptions: ComboOption[] = useMemo(
    () => cityOptions.map((o) => ({ value: o.label, label: prettyCity(o.label), hint: String(o.count) })),
    [cityOptions],
  );

  /** Mantém dias_semana igual à agenda e grava a cidade na grafia oficial */
  const prepare = useCallback(
    (data: Partial<Doctor>): Partial<Doctor> => {
      const out: Partial<Doctor> = { ...data };
      if (data.agenda) out.dias_semana = agendaToDias(data.agenda);
      if (data.cidade !== undefined) out.cidade = canonicalCity(data.cidade, cityOptions);
      // CRM só com números ("CRM 8786/PI" é montado na tela) e UF sempre em maiúsculas
      if (typeof data.crm === 'string') out.crm = normalizeCrm(data.crm);
      if (typeof data.uf === 'string') out.uf = data.uf.trim().toUpperCase();
      return out;
    },
    [cityOptions],
  );

  /* ═══════════════════ Ciclo: semanas por representante ═══════════════════
   * Guardadas em rep_route_order (day_of_week = ciclo_w1..ciclo_w5): a lista é quem está
   * na semana E a ordem da rota dela. Não precisa de coluna nova em doctors.
   */
  const weeksByDoctor = useMemo(() => {
    const out = new Map<string, CycleWeek[]>();
    for (const w of CYCLE_WEEKS) {
      for (const id of routeOrder[cycleWeekKey(w)] ?? []) {
        const list = out.get(id) ?? [];
        list.push(w);
        out.set(id, list);
      }
    }
    return out;
  }, [routeOrder]);

  const setDoctorWeeks = useCallback(
    async (docId: string, weeks: readonly number[] | null | undefined): Promise<boolean> => {
      const want = normalizeCycleWeeks(weeks);
      const jobs: Promise<unknown>[] = [];
      for (const w of CYCLE_WEEKS) {
        const key = cycleWeekKey(w);
        const list = routeOrder[key] ?? [];
        const has = list.includes(docId);
        const on = want.includes(w);
        if (on && !has) jobs.push(saveRouteOrder(key, [...list, docId]));
        else if (!on && has) jobs.push(saveRouteOrder(key, list.filter((id) => id !== docId)));
      }
      const results = await Promise.all(jobs);
      return results.every((r) => r !== false);
    },
    [routeOrder, saveRouteOrder],
  );

  /* ═══════════════════ Doctor CRUD ═══════════════════ */

  const updateDoctor = useCallback(
    async (docId: string, data: Partial<Doctor>, _docName: string): Promise<boolean> => {
      const { cycle_weeks: weeks, ...fields } = data;

      // Trocou CRM/UF: não pode bater com outro médico da base
      if (fields.crm !== undefined || fields.uf !== undefined) {
        const self = doctors.find((d) => d.id === docId);
        const crmKey = normalizeCrm(fields.crm ?? self?.crm);
        const ufKey = (fields.uf ?? self?.uf ?? 'PI').trim().toUpperCase();
        const clash = crmKey
          ? doctors.find(
              (d) => d.id !== docId && normalizeCrm(d.crm) === crmKey && (d.uf || 'PI').trim().toUpperCase() === ufKey,
            )
          : undefined;
        if (clash) {
          alert(`Esse CRM já está cadastrado para ${clash.descricao}.`);
          return false;
        }
      }

      if (weeks !== undefined && !(await setDoctorWeeks(docId, weeks))) return false;
      if (Object.keys(fields).length === 0) return true;

      const payload = { ...prepare(fields), updated_by_name: actorName, change_source: 'app' };
      const previous = doctors.find((d) => d.id === docId);

      // 1) A tela muda na hora (o selo "Atualizado por" também)
      setDoctors((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, ...payload, updated_at: new Date().toISOString() } : d)),
      );

      // Sem internet: guarda a edição no aparelho e envia quando a conexão voltar
      const queue = () => {
        if (userId) enqueue(userId, { kind: 'doctor_update', doctor_id: docId, fields: payload });
      };
      if (isOffline()) {
        queue();
        return true;
      }

      // 2) Grava
      const { error, status } = await supabase.from('doctors').update(payload).eq('id', docId);

      if (error) {
        if (isNetworkError(error, status)) {
          queue();
          return true;
        }
        console.error('Erro ao atualizar médico:', error.message, '|', error.details, '|', error.code);
        if (previous) setDoctors((prev) => prev.map((d) => (d.id === docId ? previous : d)));
        return false;
      }
      void fetchDoctors(); // confirma com o servidor sem travar a tela
      return true;
    },
    [prepare, actorName, fetchDoctors, setDoctorWeeks, doctors, userId],
  );

  const findDuplicate = useCallback(
    (crm: string | null | undefined, uf: string | null | undefined): Doctor | undefined => {
      const digits = normalizeCrm(crm);
      if (!digits) return undefined;
      const ufKey = (uf || 'PI').trim().toUpperCase();
      return doctors.find(
        (d) => normalizeCrm(d.crm) === digits && (d.uf || 'PI').trim().toUpperCase() === ufKey,
      );
    },
    [doctors],
  );

  const addDoctor = useCallback(
    async (data: Partial<Doctor>): Promise<AddDoctorResult> => {
      const dup = findDuplicate(data.crm, data.uf);
      if (dup) return { ok: false, error: DUPLICATE_MSG, duplicate: dup };

      const { cycle_weeks: weeks, ...fields } = data;
      const row = {
        ...prepare(fields),
        created_via: 'APP_FIELD',
        updated_by: session?.user.id || '',
        updated_by_name: actorName,
        created_by_name: actorName,
        change_source: 'app',
      };
      let toInsert: Record<string, unknown> = row;
      let { data: inserted, error } = await supabase.from('doctors').insert(toInsert).select('id').single();

      // Migrações v6/v7 ainda não rodadas (coluna inexistente): grava sem as colunas novas
      for (const col of ['created_by_name', 'whatsapp_medico', 'whatsapp_clinica']) {
        if (error && isMissingColumn(error, col)) {
          const { [col]: _omit, ...rest } = toInsert;
          void _omit;
          toInsert = rest;
          ({ data: inserted, error } = await supabase.from('doctors').insert(toInsert).select('id').single());
        }
      }

      if (error) {
        if (error.code === '23505') {
          await fetchDoctors();
          const { data: rows } = await supabase
            .from('doctors')
            .select('*')
            .eq('uf', (data.uf || 'PI').toUpperCase())
            .ilike('crm', `%${normalizeCrm(data.crm)}%`)
            .limit(1);
          return { ok: false, error: DUPLICATE_MSG, duplicate: (rows as Doctor[] | null)?.[0] };
        }
        console.error('Erro ao adicionar médico:', error.message, '|', error.details, '|', error.code);
        return { ok: false, error: `Não foi possível adicionar: ${error.message}` };
      }

      const newId = (inserted as { id: string } | null)?.id;
      if (newId && weeks?.length) await setDoctorWeeks(newId, weeks);

      setShowAddForm(false);
      await fetchDoctors();
      return { ok: true };
    },
    [findDuplicate, prepare, session, actorName, fetchDoctors, setDoctorWeeks],
  );

  const deleteDoctor = useCallback(
    async (doc: Doctor) => {
      if (!confirm(`Excluir ${doc.descricao}?`)) return;
      setDoctors((prev) => prev.filter((d) => d.id !== doc.id));
      const { error } = await supabase.from('doctors').delete().eq('id', doc.id);
      if (error) {
        console.error('Erro ao excluir médico:', error.message);
        fetchDoctors();
      }
    },
    [fetchDoctors],
  );

  const isInPortfolio = useCallback((doctorId: string) => portfolio.has(doctorId), [portfolio]);

  /* ═══════════════════ Logout ═══════════════════ */

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearDoctorsCache();
    setSession(null);
  };

  /* ═══════════════════ Filtros ═══════════════════ */

  const isCategoryMode = selectedCategory !== null;
  const routeDay = selectedTab && selectedTab !== 'novos' ? selectedTab : getTodayDayCode();
  const orderKey = selectedTab && selectedTab !== 'novos' ? selectedTab : 'geral';

  /** Só status ainda válidos (some na hora certa, sem esperar o servidor) */
  const liveStatusMap = useMemo(() => {
    const out: Record<string, DoctorStatus[]> = {};
    for (const [docId, list] of Object.entries(statusMap)) {
      // 'visitado_hoje' sem expiração é a visita antiga do ciclo (agora em doctor_visits): ignora
      const live = list.filter((s) => isLive(s, now) && !(s.status_type === CYCLE_VISIT_STATUS && !s.expires_at));
      if (live.length) out[docId] = live;
    }
    return out;
  }, [statusMap, now]);

  const newCount = useMemo(() => doctors.filter((d) => isNewDoctor(d)).length, [doctors]);

  const mySpecialties = profile?.specialties ?? [];
  const portfolioConfigured = mySpecialties.length > 0 || portfolio.size > 0;
  const portfolioActive = Boolean(profile && !profile.show_all && portfolioConfigured);

  /* ═══════════════════ Ciclo: visitas (doctor_statuses) ═══════════════════ */

  /** Médicos que ESTE representante marcou visitado no ciclo: doctor_id -> visited_at */
  const cycleVisits = myVisits;

  /** Marca/desfaz "Visitado". Com semana ativa, o médico entra nela e fica na sequência da visita. */
  const toggleCycleVisit = useCallback(
    (doctorId: string, visited: boolean, visitedAt?: string) => {
      if (!visited) {
        void undoVisited(doctorId);
        return;
      }
      void markVisited(doctorId, visitedAt);
      clearAttendanceStatuses(doctorId);

      if (activeWeek) {
        const key = cycleWeekKey(activeWeek);
        const current = routeOrder[key] ?? [];
        const list = current.filter((id) => id !== doctorId);
        // Trava a posição: logo depois do último médico já visitado nesta semana
        let at = 0;
        list.forEach((id, i) => {
          if (cycleVisits.has(id)) at = i + 1;
        });
        list.splice(at, 0, doctorId);
        if (list.join(',') !== current.join(',')) void saveRouteOrder(key, list);
      }
    },
    [undoVisited, markVisited, clearAttendanceStatuses, activeWeek, routeOrder, cycleVisits, saveRouteOrder],
  );

  /** Novo ciclo: zera só os "Visitado" deste representante (semanas, ordem da rota e horários médios ficam) */
  const renewCycle = useCallback(() => {
    if (!sessionUserId) return;
    setRenewAsk({}); // abre "Começar um novo ciclo?"; renewMine roda ao confirmar
  }, [sessionUserId]);

  const confirmRenew = async () => {
    setRenewBusy(true);
    const done = await renewMine();
    setRenewBusy(false);
    if (!done) {
      alert('Não foi possível renovar o ciclo. Tente novamente.');
      return;
    }
    const then = renewAsk?.then;
    setRenewAsk(null);
    then?.();
  };

  /** Médicos com as semanas DESTE representante */
  const doctorsWithWeeks = useMemo(
    () => doctors.map((d) => ({ ...d, cycle_weeks: weeksByDoctor.get(d.id) ?? [] })),
    [doctors, weeksByDoctor],
  );

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim();
    const specSet = new Set(profile?.specialties ?? []);
    const citySet = new Set(selectedCities);

    return doctorsWithWeeks.filter((d) => {
      const agenda = getAgenda(d);

      if (selectedTab === 'novos') {
        if (!isNewDoctor(d)) return false;
      } else if (selectedTab) {
        if (!agenda.some((e) => e.day === selectedTab)) return false;
      }

      if (selectedCategory && !matchesLocation(d, selectedCategory)) return false;

      // Cidade: compara sem acento ("Parnaiba" = "Parnaíba")
      if (citySet.size > 0 && !citySet.has(cityKey(d.cidade))) return false;

      if (turnoFilter) {
        const entries =
          selectedTab && selectedTab !== 'novos' ? agenda.filter((e) => e.day === selectedTab) : agenda;
        if (!entries.some((e) => shiftCovers(e.shift, turnoFilter))) return false;
      }

      // Semana do ciclo: só os médicos marcados nessa semana
      if (selectedWeek && !normalizeCycleWeeks(d.cycle_weeks).includes(selectedWeek)) return false;

      if (portfolioActive) {
        const code = specialtyCode(d.especialidade);
        if (!portfolio.has(d.id) && !(code && specSet.has(code))) return false;
      }

      if (q && !matchDoctor(d, q, searchScope).matched) return false;
      return true;
    });
  }, [doctorsWithWeeks, selectedTab, selectedCategory, selectedCities, selectedWeek, turnoFilter, searchQuery, searchScope, portfolioActive, profile, portfolio]);

  /** Médicos de cada cidade no dia escolhido (para o filtro de cidades); sem dia = sem divisão */
  const cityDayCounts = useMemo(() => {
    if (!selectedTab || selectedTab === 'novos') return undefined;
    const out: Record<string, number> = {};
    for (const d of doctors) {
      if (!getAgenda(d).some((e) => e.day === selectedTab)) continue;
      const k = cityKey(d.cidade);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }, [doctors, selectedTab]);
  const dayLongLabel = selectedTab ? DAY_LONG[selectedTab] : undefined;

  /** Sugestões ao digitar: acha em TODOS os médicos (não só no dia aberto) e leva direto à ficha */
  const suggestions = useMemo(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return [];
    const out: { doc: Doctor; hint: string | null }[] = [];
    for (const d of doctorsWithWeeks) {
      const m = matchDoctor(d, q, searchScope);
      if (m.matched) out.push({ doc: d, hint: m.hint ?? null });
    }
    return out;
  }, [doctorsWithWeeks, searchQuery, searchScope]);

  /** Onde a busca bateu em cada médico (só quando não foi no nome): "Bairro: Centro" */
  const searchHints = useMemo(() => {
    const out = new Map<string, string>();
    if (!searchQuery.trim()) return out;
    for (const d of filteredDoctors) {
      const m = matchDoctor(d, searchQuery, searchScope);
      if (m.hint) out.set(d.id, m.hint);
    }
    return out;
  }, [filteredDoctors, searchQuery, searchScope]);

  /* ═══════════════════ Ordenação em 3 blocos ═══════════════════
   * TOPO:  Último Paciente / Rep. no Consultório / Aguardando Médico (mais recente primeiro).
   * MEIO:  rota do dia — média histórica (todos os reps, por médico+dia+turno) ou ordem manual
   *        deste representante (rep_route_order), com ▲▼ e arrastar-e-soltar.
   * FIM:   Finalizou / Não veio / Licença / Viagem — esmaecidos.
   */
  /** Com semana filtrada, a ordem manual é a da semana (ciclo_wN); senão a do dia */
  const manualKey = selectedWeek ? cycleWeekKey(selectedWeek) : orderKey;
  const manualOrder = routeOrder[manualKey];
  const feed = useDoctorFilters({
    doctors: filteredDoctors,
    statusMap: liveStatusMap,
    events,
    routeDay,
    now,
    sortMode,
    manualOrder,
    categoryMode: isCategoryMode,
    cycleVisits: isCategoryMode ? undefined : cycleVisits,
  });
  const { middleIds } = feed;
  /* Sub-hierarquia do TOPO: Rep. no Consultório → Último Paciente → Aguardando Médico.
   * Dentro da mesma faixa vale a ordem que o hook já entregou (marcado mais recentemente primeiro). */
  const topDoctors = useMemo(() => {
    const rank = (id: string) =>
      Math.min(
        ...(liveStatusMap[id] || []).map((s) => {
          const i = TOP_ORDER.indexOf(s.status_type);
          return i < 0 ? TOP_ORDER.length : i;
        }),
        TOP_ORDER.length,
      );
    return [...feed.top].sort((a, b) => rank(a.id) - rank(b.id));
  }, [feed.top, liveStatusMap]);
  const sortedDoctors = useMemo(
    () => [...topDoctors, ...feed.middle, ...feed.bottom],
    [topDoctors, feed.middle, feed.bottom],
  );

  /* "Em atendimento": uma sub-lista por status. O médico entra na do status mais prioritário
   * que tem ativo (Rep. no Consultório → Último Paciente → Aguardando); dentro dela, o marcado
   * há menos tempo vem primeiro. */
  const attendanceGroups = useMemo(() => {
    const byType = new Map<DoctorStatusType, { doc: Doctor; at: number }[]>();
    for (const doc of feed.top) {
      const list = liveStatusMap[doc.id] || [];
      const lead = TOP_ORDER.find((t) => list.some((s) => s.status_type === t)) ?? 'aguardando_medico';
      const at = new Date(list.find((s) => s.status_type === lead)?.created_at ?? 0).getTime();
      byType.set(lead, [...(byType.get(lead) ?? []), { doc, at }]);
    }
    return ATTENDANCE_GROUPS.map((g) => ({
      ...g,
      docs: (byType.get(g.type) ?? []).sort((a, b) => b.at - a.at).map((x) => x.doc),
    })).filter((g) => g.docs.length > 0);
  }, [feed.top, liveStatusMap]);

  const toggleGroup = (type: string) => setOpenGroups((cur) => ({ ...cur, [type]: !cur[type] }));

  const applyMiddleOrder = useCallback(
    (visible: string[]) => {
      // Os médicos fora da lista visível (filtro, visitados, em atendimento) ficam no lugar salvo
      void saveRouteOrder(manualKey, mergeVisibleOrder(manualOrder, visible));
    },
    [manualOrder, manualKey, saveRouteOrder],
  );

  /* Arrastar e soltar (só no bloco do meio, modo manual) */
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const dropOn = useCallback(
    (targetId: string) => {
      const from = dragId.current;
      dragId.current = null;
      setDragOverId(null);
      if (!from || from === targetId) return;
      const visible = middleIds.filter((id) => id !== from);
      const at = visible.indexOf(targetId);
      if (at < 0) return;
      const fromIdx = middleIds.indexOf(from);
      const targetIdx = middleIds.indexOf(targetId);
      visible.splice(fromIdx < targetIdx ? at + 1 : at, 0, from);
      applyMiddleOrder(visible);
    },
    [middleIds, applyMiddleOrder],
  );

  /* Toque (iPhone/Android/PWA): arrasta pela alça ☰, o card "gruda" no dedo,
   * a página rola sozinha perto das bordas e soltar sobre outro card insere naquele lugar. */
  const dropRef = useRef(dropOn);
  useEffect(() => {
    dropRef.current = dropOn;
  }, [dropOn]);

  const [ghost, setGhost] = useState<{ id: string; name: string; y: number } | null>(null);
  const ghostEl = useRef<HTMLDivElement | null>(null);
  const middleDocs = feed.middle;

  const startTouchDrag = useCallback(
    (docId: string, startY: number) => {
      const name = middleDocs.find((d) => d.id === docId)?.descricao ?? '';
      dragId.current = docId;
      setDragOverId(docId);
      setGhost({ id: docId, name, y: startY });

      let overId: string | null = docId;
      let fingerX = 0;
      let fingerY = startY;
      let raf = 0;
      const EDGE_TOP = 130; // abaixo do cabeçalho fixo
      const EDGE_BOTTOM = 90;
      const MAX_SPEED = 22;

      const cardAt = (x: number, y: number): string | null => {
        const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drag-id]');
        return el?.dataset.dragId ?? null;
      };
      const updateTarget = () => {
        const hit = cardAt(fingerX || window.innerWidth / 2, fingerY);
        if (hit && hit !== overId) {
          overId = hit;
          setDragOverId(hit);
        }
      };
      // Rolagem contínua enquanto o dedo fica perto da borda (mesmo parado)
      const tick = () => {
        let speed = 0;
        if (fingerY < EDGE_TOP) speed = -MAX_SPEED * Math.min(1, (EDGE_TOP - fingerY) / EDGE_TOP);
        else if (fingerY > window.innerHeight - EDGE_BOTTOM)
          speed = MAX_SPEED * Math.min(1, (fingerY - (window.innerHeight - EDGE_BOTTOM)) / EDGE_BOTTOM);
        if (speed !== 0) {
          window.scrollBy(0, speed);
          updateTarget();
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      const onMoveTouch = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        e.preventDefault(); // impede o scroll nativo; a rolagem é feita pelo tick()
        fingerX = t.clientX;
        fingerY = t.clientY;
        if (ghostEl.current) ghostEl.current.style.transform = `translateY(${fingerY - 28}px)`;
        updateTarget();
      };
      const cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('touchmove', onMoveTouch);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onCancel);
        setGhost(null);
      };
      const onEnd = () => {
        cleanup();
        if (overId) dropRef.current(overId);
      };
      const onCancel = () => {
        cleanup();
        dragId.current = null;
        setDragOverId(null);
      };
      document.addEventListener('touchmove', onMoveTouch, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onCancel);
    },
    [middleDocs],
  );

  const middleIndex = useMemo(() => new Map(middleIds.map((id, i) => [id, i])), [middleIds]);

  const routeShown = !routeClosed || searchQuery.trim() !== '';
  const bottomShown = bottomOpen || searchQuery.trim() !== '';
  const unavailShown = unavailOpen || searchQuery.trim() !== '';

  const cycleVisitedCount = filteredDoctors.filter((d) => cycleVisits.has(d.id)).length;

  const visitedCount = isCategoryMode
    ? sortedDoctors.filter((d) => (liveStatusMap[d.id] || []).some((s) => s.status_type === 'visitado_hoje')).length
    : 0;

  const cityLabelOf = (key: string) => prettyCity(cityOptions.find((o) => o.value === key)?.label ?? key);

  /* ═══════════════════ Layout: ficha aberta, próximo, barra de ações ═══════════════════ */

  /** ficha aberta (sobe de baixo) e card em edição */
  const [sheetId, setSheetId] = useState<string | null>(null);
  /** Tela geral de Status (todos os médicos marcados, agrupados pelo status) */
  const [showStatusOverview, setShowStatusOverview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const openSheet = useCallback((id: string) => setSheetId(id), []);
  const closeSheet = useCallback(() => setSheetId(null), []);
  const endEdit = useCallback(() => setEditingId(null), []);

  /** Próximo da rota: o primeiro do bloco do meio ainda não visitado */
  const nextDoctor = useMemo(
    () => (isCategoryMode ? null : feed.middle.find((d) => !cycleVisits.has(d.id)) ?? null),
    [isCategoryMode, feed.middle, cycleVisits],
  );
  /** A barra de baixo age sobre a ficha aberta; sem ficha aberta, sobre o próximo */
  const sheetDoc = sheetId ? doctorsWithWeeks.find((d) => d.id === sheetId) ?? null : null;
  const targetDoc = sheetDoc ?? nextDoctor;
  const targetVisited = targetDoc
    ? isCategoryMode
      ? (liveStatusMap[targetDoc.id] || []).some((s) => s.status_type === 'visitado_hoje')
      : cycleVisits.has(targetDoc.id)
    : false;
  const targetNav = targetDoc ? navigationUrl(targetDoc) : null;

  /** Visitado do ciclo (rota) ou do dia (PSM/SAMU/Hospital) */
  const visitedAtOf = (id: string): string | null =>
    isCategoryMode
      ? (liveStatusMap[id] || []).find((s) => s.status_type === 'visitado_hoje')?.created_at ?? null
      : cycleVisits.get(id) ?? null;
  /** Quem visitou o médico no ciclo (eu primeiro), com nome e foto */
  const visitorsByDoctor = useMemo(() => {
    const out: Record<string, Visitor[]> = {};
    for (const [docId, list] of Object.entries(visitMap)) {
      const v = visitorsOf(list, repProfiles, sessionUserId);
      if (v.length) out[docId] = v;
    }
    return out;
  }, [visitMap, repProfiles, sessionUserId]);
  const visitorsFor = (id: string): Visitor[] => visitorsByDoctor[id] ?? NO_VISITORS;
  const visitLabelOf = (id: string): string | null => {
    if (isCategoryMode) {
      // PSM/SAMU/Hospital: visita do dia continua em doctor_statuses
      const v = (liveStatusMap[id] || []).find((s) => s.status_type === 'visitado_hoje');
      return v ? formatVisitAudit(v.rep_name, v.created_at, now) : null;
    }
    return visitorsSummary(visitorsFor(id), (name, iso) => formatVisitAudit(name, iso, now));
  };
  /** Plantonistas de hoje: médicos de PSM/SAMU/Hospital que QUALQUER representante já visitou hoje.
   * Saem da Rota e da lista de Visitados para ninguém voltar neles quando o plantão troca. */
  const plantaoIds = useMemo(() => {
    const out = new Set<string>();
    if (isCategoryMode) return out;
    const today = new Date(now).toDateString();
    for (const d of [...feed.middle, ...feed.visited]) {
      if (!(['psm', 'samu', 'hospital'] as const).some((c) => matchesLocation(d, c))) continue;
      const byStatus = (liveStatusMap[d.id] || []).some((s) => s.status_type === 'visitado_hoje');
      const byVisit = (visitorsByDoctor[d.id] ?? []).some((v) => new Date(v.visitedAt).toDateString() === today);
      if (byStatus || byVisit) out.add(d.id);
    }
    return out;
  }, [isCategoryMode, now, feed.middle, feed.visited, liveStatusMap, visitorsByDoctor]);
  const routeList = feed.middle.filter((d) => !plantaoIds.has(d.id));
  const visitedList = feed.visited.filter((d) => !plantaoIds.has(d.id));
  const plantaoList = [...feed.middle, ...feed.visited].filter((d) => plantaoIds.has(d.id));
  const [plantaoOpen, setPlantaoOpen] = useState(false);
  const plantaoShown = plantaoOpen || searchQuery.trim() !== '';

  const presenceFor = (id: string): PresenceItem[] =>
    presenceItems(liveStatusMap[id], isCategoryMode ? undefined : visitorsFor(id), repProfiles, sessionUserId);
  const toggleVisited = (id: string) => {
    const visited = Boolean(visitedAtOf(id));
    if (isCategoryMode) {
      if (visited) void clearDoctorStatus(id, 'visitado_hoje');
      else {
        void setDoctorStatus(id, 'visitado_hoje');
        clearAttendanceStatuses(id);
      }
    } else {
      toggleCycleVisit(id, !visited);
    }
  };
  const toggleTargetVisited = () => {
    if (targetDoc) toggleVisited(targetDoc.id);
  };
  const openTargetStatus = () => {
    if (targetDoc) setSheetId(targetDoc.id);
  };

  /* ═══════════════════ "Já visitou?" (status vencido) ═══════════════════
   * Fila de perguntas: uma de cada vez, e a janela bloqueia o app até responder.
   * Saem da fila sem perguntar: médico que não existe mais no painel e quem já visitou depois de marcar.
   */
  const promptQueue = useMemo<VisitPrompt[]>(() => {
    if (doctors.length === 0 || !visitsReady) return []; // espera médicos e visitas carregarem
    const byId = new Set(doctors.map((d) => d.id));
    return rawPrompts.filter((p) => byId.has(p.doctor_id) && !alreadyVisited(p, myVisits));
  }, [rawPrompts, doctors, myVisits, visitsReady]);

  useEffect(() => {
    if (doctors.length === 0 || !visitsReady) return;
    const byId = new Set(doctors.map((d) => d.id));
    for (const p of rawPrompts) {
      if (!byId.has(p.doctor_id) || alreadyVisited(p, myVisits)) void resolvePrompt(p);
    }
  }, [rawPrompts, doctors, myVisits, visitsReady, resolvePrompt]);

  /* ═══════════════════ Tutorial (primeiro acesso) ═══════════════════
   * Abre depois de tudo que é pergunta (nome, semana e avisos, "Já visitou?"), uma vez por usuário.
   */
  const tourSeen = Boolean(profile?.tour_seen_at) || (userId ? getFlag(userId, 'tour-seen') === '1' : false);
  useEffect(() => {
    if (tourOpen || tourDismissed || tourSeen) return;
    if (!userId || !profile || doctors.length === 0) return;
    if (needName || weekPrompt || renewAsk || promptQueue.length > 0 || sheetId || showProfile) return;
    setTourOpen(true);
  }, [tourOpen, tourDismissed, tourSeen, userId, profile, doctors.length, needName, weekPrompt, renewAsk, promptQueue.length, sheetId, showProfile]);

  const endTour = () => {
    setTourOpen(false);
    setTourDismissed(true);
    if (!userId) return;
    setFlag(userId, 'tour-seen', '1'); // reserva: sem a coluna v12 não pode repetir
    void saveProfile({ tour_seen_at: new Date().toISOString() });
  };

  /* ═══════════════════ Avisos por semana ═══════════════════ */
  const weekCityList = (w: number): string[] => weekCities.byWeek[w] ?? [];
  /** sugestão: cidades dos médicos marcados naquela semana */
  const defaultWeekCities = (w: number): string[] => {
    const keys = new Set<string>();
    for (const d of doctors) {
      if (d.cidade && weeksByDoctor.get(d.id)?.includes(w as CycleWeek)) keys.add(cityKey(d.cidade));
    }
    return [...keys];
  };
  const saveWeekAlerts = async (week: CycleWeek, v: { notify: boolean; cities: string[] }): Promise<string | null> => {
    if (!userId) return 'Entre na sua conta para salvar.';
    await weekCities.save(week, v.cities);
    void saveProfile({ notify_enabled: v.notify });
    if (v.notify) {
      if (getPushSupport() === 'unsupported') {
        return 'Este aparelho não suporta avisos. No iPhone, instale o app na Tela de Início primeiro.';
      }
      const first = v.cities[0];
      const label = cityOptions.find((o) => o.value === first)?.label ?? first;
      const r = await subscribeToCity(userId, label);
      if (!r.ok) return r.message;
    } else {
      await unsubscribePush();
    }
    return null;
  };

  /** Interruptor "Avisos dos colegas" do perfil: usa as cidades da semana ativa */
  const toggleNotify = async (on: boolean): Promise<string | null> => {
    if (!activeWeek) return 'Escolha a semana de trabalho primeiro.';
    const saved = weekCityList(activeWeek);
    const cities = saved.length > 0 ? saved : defaultWeekCities(activeWeek);
    if (on && cities.length === 0) return 'Escolha pelo menos uma cidade primeiro.';
    return saveWeekAlerts(activeWeek, { notify: on, cities });
  };

  /** perguntas já respondidas nesta rodada (para "1 de 2 perguntas") */
  const [answeredRound, setAnsweredRound] = useState(0);
  useEffect(() => {
    if (promptQueue.length === 0) setAnsweredRound(0);
  }, [promptQueue.length]);

  const answerVisited = (p: VisitPrompt) => {
    const doc = doctors.find((d) => d.id === p.doctor_id);
    setAnsweredRound((n) => n + 1);
    if (doc && (['psm', 'samu', 'hospital'] as const).some((c) => matchesLocation(doc, c))) {
      // PSM/SAMU/Hospital: a visita é do dia (plantão), como no botão Visitado desses locais
      void setDoctorStatus(doc.id, 'visitado_hoje');
      clearAttendanceStatuses(doc.id);
    } else if (doc) {
      // visita do ciclo, com a hora em que o representante marcou que estava lá
      toggleCycleVisit(doc.id, true, p.created_at);
    }
    void resolvePrompt(p);
  };
  const answerNotYet = (p: VisitPrompt) => {
    setAnsweredRound((n) => n + 1);
    void resolvePrompt(p);
  };

  const activeFilterCount =
    (selectedCities.length > 0 ? 1 : 0) +
    (selectedWeek ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (turnoFilter ? 1 : 0) +
    (sortMode === 'historico' ? 1 : 0) +
    (portfolioActive ? 1 : 0);
  const dayLabel = TABS_NAVEGACAO.find((t) => t.value === routeDay)?.label ?? '';

  const renderCard = (doc: Doctor, tier: RouteTier) => {
    const pos = tier === 'middle' ? middleIndex.get(doc.id) : undefined;
    const manual = sortMode === 'manual' && pos !== undefined;
    const card = (
      <DoctorCard
        key={doc.id}
        doc={doc}
        tier={tier}
        statuses={liveStatusMap[doc.id] || []}
        categoryMode={isCategoryMode}
        onUpdateDoctor={updateDoctor}
        onDeleteDoctor={deleteDoctor}
        onSetStatus={setDoctorStatus}
        onClearStatus={clearDoctorStatus}
        cityOptions={cityComboOptions}
        expected={sortMode === 'historico' ? feed.expected.get(doc.id) ?? null : null}
        onDragHandleTouchStart={manual ? startTouchDrag : undefined}
        routeNumber={pos !== undefined ? pos + 1 : undefined}
        cycleVisitedAt={isCategoryMode ? null : cycleVisits.get(doc.id) ?? null}
        visitors={isCategoryMode ? undefined : visitorsFor(doc.id)}
        presence={presenceFor(doc.id)}
        searchHint={searchHints.get(doc.id) ?? null}
        onToggleCycleVisit={isCategoryMode ? undefined : toggleCycleVisit}
        activeWeekLabel={activeWeek ? cycleWeekLabel(activeWeek) : null}
        expanded={editingId === doc.id}
        onToggleExpand={openSheet}
        autoEdit={editingId === doc.id}
        onEditEnd={endEdit}
        now={tier === 'top' || tier === 'bottom' ? now : undefined}
      />
    );
    if (!manual) return card;
    return (
      <div
        key={doc.id}
        data-drag-id={doc.id}
        draggable
        onDragStart={(e) => {
          dragId.current = doc.id;
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragOverId !== doc.id) setDragOverId(doc.id);
          // rolagem automática do arraste com mouse
          if (e.clientY < 130) window.scrollBy(0, -16);
          else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 16);
        }}
        onDragLeave={() => setDragOverId((cur) => (cur === doc.id ? null : cur))}
        onDrop={(e) => {
          e.preventDefault();
          dropOn(doc.id);
        }}
        onDragEnd={() => {
          dragId.current = null;
          setDragOverId(null);
        }}
        className={`rounded-2xl cursor-grab active:cursor-grabbing ${dragOverId === doc.id ? 'ring-2 ring-sky-500' : ''} ${ghost?.id === doc.id ? 'opacity-40' : ''}`}
      >
        {card}
      </div>
    );
  };

  /* ═══════════════════ Render ═══════════════════ */

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950">
        <div className="text-slate-500 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      {/* Cabeçalho: título, busca, filtros recolhidos e dias */}
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 pt-4 pb-3 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <button
              type="button"
              data-tour="week"
              onClick={() => {
                setWeekAuto(false);
                setWeekPrompt(true);
              }}
              className="self-start bg-transparent border-0 p-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 truncate hover:text-slate-200"
            >
              {dayLabel}
              {' · '}
              {activeWeek ? cycleWeekLabel(activeWeek) : 'Escolher semana'}
            </button>
            <h1 className="m-0 flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              Rota de hoje
              <span
                title={realtimeOn ? 'Tempo real conectado' : 'Tempo real desconectado (atualiza a cada 8 s)'}
                className={`size-2 rounded-full ${realtimeOn ? 'bg-emerald-500' : 'bg-slate-600'}`}
              />
              {(!offline.online || offline.pending > 0) && (
                <span
                  role="status"
                  className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-amber-400"
                >
                  {!offline.online ? 'Sem internet' : offline.syncing ? 'Enviando' : 'Pendente'}
                  {offline.pending > 0 && ` · ${offline.pending} ${offline.pending === 1 ? 'alteração' : 'alterações'}`}
                </span>
              )}
            </h1>
          </div>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={() => setShowAddForm((p) => !p)}
              data-tour="add"
              aria-label="Novo médico"
              className="size-10 shrink-0 rounded-full border-0 bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button type="button" onClick={() => setShowProfile(true)} data-tour="profile" aria-label="Meu perfil" className={iconBtn}>
              {profile?.avatar_url ? (
                <RepAvatar name={actorName} src={profile.avatar_url} size={34} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Busca + botão de filtros */}
        <div className="flex gap-2">
          <label data-tour="search" className="flex-1 min-w-0 flex items-center gap-2 h-11 px-3.5 rounded-xl border border-slate-800 bg-slate-900">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-400" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              aria-label="Buscar"
              placeholder="Buscar médico, CRM, bairro, telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
              className="flex-1 min-w-0 border-0 bg-transparent text-base sm:text-sm text-slate-100 outline-hidden placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Limpar busca"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearchQuery('');
                  setSearchScope('tudo');
                }}
                className="size-6 shrink-0 rounded-full border-0 bg-slate-700 text-slate-200 flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowStatusOverview(true)}
            aria-label="Status geral: médicos marcados pelos representantes"
            title="Status geral"
            className="h-11 px-3 shrink-0 rounded-xl border border-slate-800 bg-slate-900 text-slate-200 flex items-center gap-1.5 text-sm font-medium"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11" />
            </svg>
            Status
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            data-tour="filters"
            aria-expanded={showFilters}
            className={`h-11 px-3.5 shrink-0 rounded-xl border flex items-center gap-1.5 text-sm font-medium ${
              showFilters ? 'border-blue-600 bg-slate-900 text-white' : 'border-slate-800 bg-slate-900 text-slate-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filtros
            {activeFilterCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Onde procurar (aparece enquanto busca) */}
        {(searchFocus || searchQuery.trim() !== '') && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Onde procurar">
            {SEARCH_SCOPES.map((sc) => (
              <button
                key={sc.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchScope(sc.value)}
                aria-pressed={searchScope === sc.value}
                className={`h-8 px-3 rounded-full text-xs whitespace-nowrap shrink-0 ${
                  searchScope === sc.value
                    ? 'border-0 bg-slate-100 text-slate-950 font-semibold'
                    : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}

        {/* Sugestões: toque no nome e abre a ficha do médico */}
        {searchFocus && suggestions.length > 0 && (
          <div
            role="listbox"
            aria-label="Médicos encontrados"
            className="flex max-h-[38dvh] flex-col overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900"
          >
            <span className="px-3.5 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {suggestions.length} encontrado{suggestions.length !== 1 ? 's' : ''}
            </span>
            {suggestions.slice(0, 8).map(({ doc, hint }) => (
              <button
                key={doc.id}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearchFocus(false);
                  (document.activeElement as HTMLElement | null)?.blur?.();
                  openSheet(doc.id);
                }}
                className="flex min-h-12 w-full flex-col items-start justify-center gap-0.5 border-0 border-t border-slate-800 bg-transparent px-3.5 py-2 text-left first:border-t-0 hover:bg-slate-800 active:bg-slate-800"
              >
                <span className="w-full truncate text-sm font-semibold uppercase text-white">{doc.descricao}</span>
                <span className="w-full truncate text-xs uppercase text-slate-400">
                  {[doc.especialidade, doc.complemento, doc.cidade].filter(Boolean).join(' · ')}
                  {hint ? ` · ${hint}` : ''}
                </span>
              </button>
            ))}
            {suggestions.length > 8 && (
              <span className="px-3.5 py-2 text-xs text-slate-500">
                Mais {suggestions.length - 8} na lista abaixo. Continue digitando para afinar.
              </span>
            )}
          </div>
        )}

        {/* Dias (clicar de novo no dia ativo limpa o filtro) */}
        <div data-tour="days" className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {TABS_NAVEGACAO.filter((tab) => tab.value !== 'novos').map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedTab(selectedTab === tab.value ? null : tab.value)}
              aria-pressed={selectedTab === tab.value}
              className={`h-9 px-4 rounded-full text-[13px] whitespace-nowrap shrink-0 ${
                selectedTab === tab.value ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Novos médicos cadastrados (logo abaixo dos dias) */}
        <div className="flex">
          <button
            type="button"
            onClick={() => setSelectedTab(selectedTab === 'novos' ? null : 'novos')}
            aria-pressed={selectedTab === 'novos'}
            className={`h-9 px-4 rounded-full text-[13px] whitespace-nowrap flex items-center gap-1.5 ${
              selectedTab === 'novos' ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            NOVOS MÉDICOS CADASTRADOS
            {newCount > 0 && (
              <span className="rounded-full bg-green-600 px-1.5 text-[10px] text-white">{newCount}</span>
            )}
          </button>
        </div>

        {/* Filtros recolhidos */}
        {showFilters && (
          <BottomSheet
            title="Filtros"
            onClose={() => setShowFilters(false)}
            footer={
              <>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCities([]);
                      changeWeek(null);
                      setSelectedCategory(null);
                      setTurnoFilter(null);
                      changeSortMode('manual');
                    }}
                    className="h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-4 text-sm font-medium text-slate-300 hover:text-red-400"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500"
                >
                  Ver {filteredDoctors.length} médico{filteredDoctors.length !== 1 ? 's' : ''}
                </button>
              </>
            }
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cidades</span>
              <CityFilter
                options={cityOptions}
                selected={selectedCities}
                onChange={setSelectedCities}
                dayCounts={cityDayCounts}
                dayLabel={dayLongLabel}
              />
            </div>

            {activeWeek && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Avisos da {activeWeek}ª semana
                </span>
                <CityFilter
                  pickMode
                  options={cityOptions}
                  selected={weekTemp ?? weekCityList(activeWeek)}
                  onChange={(keys) => {
                    if (weekSave) {
                      setWeekTemp(null);
                      void weekCities.save(activeWeek, keys);
                    } else {
                      setWeekTemp(keys);
                    }
                  }}
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={weekSave}
                  onClick={() => {
                    if (!weekSave && weekTemp) {
                      void weekCities.save(activeWeek, weekTemp);
                      setWeekTemp(null);
                    }
                    setWeekSave((v) => !v);
                  }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3.5 text-left"
                >
                  <span className="text-sm text-slate-100">Salvar na {activeWeek}ª semana</span>
                  <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${weekSave ? 'bg-blue-600' : 'bg-slate-600'}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${weekSave ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                </button>
                <span className="text-xs text-slate-500">
                  São as cidades de onde você recebe avisos dos colegas. Elas não escondem médicos da lista.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Semana do ciclo</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Semana do ciclo">
                {[null, ...CYCLE_WEEKS].map((w) => (
                  <button
                    key={w ?? 'todas'}
                    type="button"
                    onClick={() => changeWeek(w)}
                    aria-pressed={selectedWeek === w}
                    className={`h-8 px-3 rounded-full text-xs whitespace-nowrap shrink-0 ${
                      selectedWeek === w ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {w === null ? 'Todas' : cycleWeekLabel(w)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Local e carteira</span>
              <div className="flex gap-1.5 flex-wrap">
                {FILTROS_PLANTAO.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setSelectedCategory(selectedCategory === f.value ? null : f.value)}
                    aria-pressed={selectedCategory === f.value}
                    className={`h-8 px-3 rounded-full text-xs ${
                      selectedCategory === f.value ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (!portfolioConfigured) {
                      setShowProfile(true);
                      return;
                    }
                    saveProfile({ show_all: !profile?.show_all });
                  }}
                  aria-pressed={portfolioActive}
                  title={portfolioConfigured ? 'Alternar entre minha carteira e todos' : 'Escolha suas especialidades no perfil'}
                  className={`h-8 px-3 rounded-full text-xs ${
                    portfolioActive ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {portfolioActive ? 'Minha carteira' : 'Todos'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Turno e ordenação</span>
              <div className="flex gap-1.5 flex-wrap">
                {FILTROS_TURNO.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTurnoFilter(turnoFilter === t.value ? null : t.value)}
                    aria-pressed={turnoFilter === t.value}
                    className={`h-8 px-3 rounded-full text-xs ${
                      turnoFilter === t.value ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => changeSortMode(sortMode === 'historico' ? 'manual' : 'historico')}
                  aria-pressed={sortMode === 'historico'}
                  title="Ordena pelo horário médio em que cada médico costuma atender"
                  className={`h-8 px-3 rounded-full text-xs ${
                    sortMode === 'historico'
                      ? 'border-0 bg-slate-100 text-slate-950 font-semibold'
                      : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Média histórica
                </button>
              </div>
            </div>
          </BottomSheet>
        )}
      </header>

      {/* Install Banner */}
      {install.showBanner && <InstallBanner onInstall={install.install} onDismiss={install.dismiss} />}

      {/* Perfil */}
      {showProfile && profile && userId && (
        <ProfileSheet
          name={profile.display_name ?? ''}
          email={session.user.email ?? ''}
          avatarUrl={profile.avatar_url ?? null}
          activeWeek={activeWeek}
          cityOptions={cityOptions}
          weekCities={activeWeek ? weekCityList(activeWeek) : []}
          onCitiesChange={(keys) => {
            if (activeWeek) void weekCities.save(activeWeek, keys);
          }}
          cycleVisitedCount={cycleVisits.size}
          notifyOn={profile.notify_enabled !== false}
          themePref={themePref}
          onChangeWeek={() => {
            setShowProfile(false);
            setWeekAuto(false);
            setWeekPrompt(true);
          }}
          onRenewCycle={renewCycle}
          onToggleNotify={toggleNotify}
          onThemeChange={changeTheme}
          onOpenGuide={() => setShowGuide(true)}
          onReplayTour={() => {
            setShowProfile(false);
            setTourOpen(true);
          }}
          onEditProfile={() => setShowEditProfile(true)}
          onLogout={handleLogout}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showEditProfile && profile && (
        <EditProfileSheet
          email={session.user.email ?? ''}
          name={profile.display_name ?? ''}
          avatarUrl={profile.avatar_url ?? null}
          onSave={saveProfile}
          onClose={() => setShowEditProfile(false)}
        />
      )}

      {/* Conteúdo */}
      <main className="px-4 pt-4 pb-36 flex flex-col gap-2.5">
        {showAddForm && (
          <BottomSheet onClose={() => setShowAddForm(false)} dismissOnBackdrop={false}>
          <AddDoctorForm
            embedded
            onAdd={addDoctor}
            onLinkPortfolio={linkDoctor}
            isInPortfolio={isInPortfolio}
            onCancel={() => setShowAddForm(false)}
            cityOptions={cityComboOptions}
            findDuplicate={findDuplicate}
          />
          </BottomSheet>
        )}

        {/* Próximo da rota */}
        {nextDoctor && (
          <section
            aria-label="Próximo médico"
            className="rounded-2xl border border-blue-600 bg-slate-900 p-4 flex flex-col gap-3"
          >
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-400">Próximo</span>
              <span className="text-xs text-slate-400">
                {cycleVisitedCount} de {filteredDoctors.length} visitado{cycleVisitedCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() => openSheet(nextDoctor.id)}
              className="text-left bg-transparent border-0 p-0 flex flex-col gap-1"
            >
              <span className="text-lg font-semibold uppercase text-white">{nextDoctor.descricao}</span>
              <span className="text-sm uppercase text-slate-400">
                {[nextDoctor.complemento || 'Consultório próprio', nextDoctor.bairro].filter(Boolean).join(' · ')}
              </span>
            </button>
            <div className="flex justify-between items-center gap-2">
              <span className="min-w-0 text-sm text-slate-200">
                {(() => {
                  // Colegas no consultório / que já visitaram: nome e hora no lugar do "esperado"
                  const presence = presenceFor(nextDoctor.id);
                  if (presence.length > 0) return <PresenceTags items={presence} />;
                  const e = feed.expected.get(nextDoctor.id);
                  const expectedText = e ? `${formatMinutes(e.startMinutes)} esperado` : null;
                  // Se um colega já visitou, mostra quem e quando (sem mexer na rota do dia)
                  const visit = visitLabelOf(nextDoctor.id);
                  if (visit) return expectedText ? `${visit} · ${expectedText}` : visit;
                  return expectedText ?? 'Sem horário médio ainda';
                })()}
              </span>
              <button
                type="button"
                onClick={() => toggleVisited(nextDoctor.id)}
                className="h-11 px-5 rounded-xl border-0 bg-emerald-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-emerald-500"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Visitado
              </button>
            </div>
          </section>
        )}

        {/* Contagem */}
        <div className="flex justify-between items-center gap-2 text-xs text-slate-500 flex-wrap px-0.5">
          <span>
            {sortedDoctors.length} médico{sortedDoctors.length !== 1 ? 's' : ''}
            {selectedCategory && <span> · {selectedCategory.toUpperCase()}</span>}
            {selectedCities.length > 0 && <span> · {selectedCities.map((k) => cityLabelOf(k)).join(', ')}</span>}
            {isCategoryMode && (
              <span className="text-emerald-400">
                {' '}
                · {visitedCount} visitado{visitedCount !== 1 ? 's' : ''}
              </span>
            )}
            {loading && <span className="text-blue-400"> · Atualizando...</span>}
          </span>
          {sortMode === 'historico' && <span>Média histórica</span>}
        </div>

        {/* Cards em 3 blocos */}
        <FeedErrorBoundary resetKey={resumeTick}>
        {sortedDoctors.length === 0 && !loading ? (
          <div className="text-center text-slate-500 text-sm py-12">Nenhum médico encontrado para o filtro selecionado.</div>
        ) : (
          <>
            {topDoctors.length > 0 && (
              <SectionTitle tone="text-red-400">Em atendimento · {topDoctors.length}</SectionTitle>
            )}
            {attendanceGroups.map((g) => {
              // Sempre recolhida: 2 cards + botão azul "Ver todos (N)" logo abaixo do último
              const collapsible = g.docs.length > COLLAPSED_VISIBLE;
              const open = collapsible && Boolean(openGroups[g.type]);
              return (
                <div key={g.type} className="flex flex-col gap-2.5">
                  <SectionTitle tone={g.tone}>
                    {g.title} ({g.docs.length})
                  </SectionTitle>
                  {(open ? g.docs : g.docs.slice(0, COLLAPSED_VISIBLE)).map((doc) => renderCard(doc, 'top'))}
                  {collapsible && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.type)}
                      aria-expanded={open}
                      className="h-11 w-full rounded-[14px] border border-blue-400/55 bg-blue-500/15 text-sm font-bold text-blue-300 hover:bg-blue-500/25"
                    >
                      {open ? 'Mostrar menos' : `Ver todos (${g.docs.length})`}
                    </button>
                  )}
                </div>
              );
            })}

            {routeList.length > 0 && (
              <CollapsibleTitle
                title="Rota"
                count={routeList.length}
                open={routeShown}
                onToggle={toggleRouteClosed}
                hint={routeShown ? 'Recolher' : 'Expandir'}
              />
            )}
            {routeShown && routeList.map((doc) => renderCard(doc, 'middle'))}

            {plantaoList.length > 0 && (
              <CollapsibleTitle
                title="Plantonistas hoje"
                count={plantaoList.length}
                open={plantaoShown}
                onToggle={() => setPlantaoOpen((o) => !o)}
                hint={plantaoShown ? 'Recolher' : 'Expandir'}
              />
            )}
            {plantaoShown && plantaoList.map((doc) => renderCard(doc, 'bottom'))}

            {visitedList.length > 0 && (
              <CollapsibleTitle
                title="Visitados hoje"
                variant="visited"
                count={visitedList.length}
                open={bottomShown}
                onToggle={toggleBottomOpen}
                hint={bottomShown ? 'Recolher' : 'Expandir'}
              />
            )}
            {bottomShown && visitedList.map((doc) => renderCard(doc, 'bottom'))}

            {feed.unavailable.length > 0 && (
              <CollapsibleTitle
                title="Indisponíveis"
                count={feed.unavailable.length}
                open={unavailShown}
                onToggle={toggleUnavailOpen}
                hint={unavailShown ? 'Recolher' : 'Expandir'}
              />
            )}
            {unavailShown && feed.unavailable.map((doc) => renderCard(doc, 'bottom'))}
          </>
        )}
        </FeedErrorBoundary>
      </main>

      {/* Barra de ações fixa (no alcance do polegar) */}
      {targetDoc && !sheetDoc && (
        <nav
          aria-label="Ações rápidas"
          className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
        >
          <div className="mx-auto max-w-xl rounded-[22px] border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-black/40 p-2 flex flex-col gap-1.5">
            <span className="px-2 text-[11px] uppercase text-slate-400 truncate">{targetDoc.descricao}</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!targetNav}
                onClick={() => targetNav && openExternal(targetNav)}
                className="h-[52px] rounded-2xl border-0 bg-blue-600 text-white text-sm font-bold flex flex-col items-center justify-center gap-0.5 hover:bg-blue-500 disabled:opacity-40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 11l18-8-8 18-2-8-8-2z" />
                </svg>
                Ir
              </button>
              <button
                type="button"
                onClick={toggleTargetVisited}
                aria-pressed={targetVisited}
                className={`h-[52px] rounded-2xl border text-sm font-semibold flex flex-col items-center justify-center gap-0.5 ${
                  targetVisited
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-700 bg-slate-800 text-slate-100'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                {targetVisited ? 'Desfazer' : 'Visitado'}
              </button>
              <button
                type="button"
                onClick={openTargetStatus}
                className="h-[52px] rounded-2xl border border-slate-700 bg-slate-800 text-slate-100 text-sm font-semibold flex flex-col items-center justify-center gap-0.5"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 21V4M5 4h11l-2.5 4L16 12H5" />
                </svg>
                Status
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Semana do ciclo → aviso de ciclo → avisos dos colegas (abre sozinho no primeiro acesso de cada segunda) */}
      {weekPrompt && !needName && (
        <WeekSetupFlow
          activeWeek={activeWeek}
          lastWeek={lastWeek}
          auto={weekAuto}
          cityOptions={cityOptions}
          savedCities={weekCityList}
          defaultCities={defaultWeekCities}
          notifyInitial={profile?.notify_enabled !== false}
          onPickWeek={pickWeek}
          onRequestRenew={(then) => setRenewAsk({ then })}
          onSaveAlerts={saveWeekAlerts}
          onClose={() => {
            setWeekPrompt(false);
            setWeekAuto(false);
          }}
        />
      )}

      {/* Confirmação de renovar o ciclo */}
      {renewAsk && (
        <ConfirmSheet
          title="Começar um novo ciclo?"
          confirmLabel="Sim, começar"
          busy={renewBusy}
          onConfirm={() => void confirmRenew()}
          onCancel={() => setRenewAsk(null)}
        >
          <p className="m-0">
            As <strong className="text-slate-100">suas</strong> visitas voltam para pendente. As dos colegas não mudam, e o histórico fica guardado.
          </p>
          <p className="m-0 text-slate-400">A ordem da rota e as semanas dos médicos continuam iguais.</p>
        </ConfirmSheet>
      )}

      {/* Status geral: médicos marcados por qualquer representante, agrupados pelo status */}
      {showStatusOverview && (
        <StatusOverview
          doctors={doctors}
          statusMap={liveStatusMap}
          profiles={repProfiles}
          myId={sessionUserId}
          onOpenDoctor={(id) => {
            setShowStatusOverview(false);
            setSheetId(id);
          }}
          onClose={() => setShowStatusOverview(false)}
        />
      )}

      {/* Ficha do médico (sobe de baixo) */}
      {sheetDoc && (
        <DoctorSheet
          doc={sheetDoc}
          statuses={liveStatusMap[sheetDoc.id] || []}
          expected={feed.expected.get(sheetDoc.id) ?? null}
          visitedAt={visitedAtOf(sheetDoc.id)}
          visitLabel={visitLabelOf(sheetDoc.id)}
          visitors={isCategoryMode ? undefined : visitorsFor(sheetDoc.id)}
          presence={presenceFor(sheetDoc.id)}
          profiles={repProfiles}
          activeWeekLabel={!isCategoryMode && activeWeek ? cycleWeekLabel(activeWeek) : null}
          onToggleVisited={() => toggleVisited(sheetDoc.id)}
          onSetStatus={setDoctorStatus}
          onClearStatus={clearDoctorStatus}
          onNavigate={(() => {
            const url = navigationUrl(sheetDoc);
            return url ? () => openExternal(url) : null;
          })()}
          cityOptions={cityComboOptions}
          onUpdateDoctor={updateDoctor}
          onDelete={() => {
            setSheetId(null);
            void deleteDoctor(sheetDoc);
          }}
          onClose={closeSheet}
        />
      )}

      {/* Guia de cores e status */}
      {showGuide && <StatusGuide onClose={() => setShowGuide(false)} />}

      {/* Dicas da tela inicial (primeiro acesso ou "Rever o tutorial") */}
      {tourOpen && <Tour onFinish={endTour} onSkip={endTour} />}

      {/* Primeiro acesso: como os colegas te chamam */}
      {needName && session && (
        <NameConfirmSheet
          suggested={suggestName(
            profile?.display_name,
            (session.user as { user_metadata?: { full_name?: string; name?: string } }).user_metadata?.full_name ??
              (session.user as { user_metadata?: { name?: string } }).user_metadata?.name,
            session.user.email,
          )}
          avatarUrl={profile?.avatar_url}
          saving={nameSaving}
          onConfirm={(n) => void confirmName(n)}
          onLater={() => setNameLater(true)}
        />
      )}

      {/* "Já visitou?": bloqueia o uso até responder; uma pergunta de cada vez */}
      {promptQueue[0] && (
        <VisitPromptModal
          key={promptQueue[0].id}
          doctorName={doctors.find((d) => d.id === promptQueue[0].doctor_id)?.descricao ?? ''}
          statusLabel={STATUS_META[promptQueue[0].status_type].label}
          startedAt={formatTime(promptQueue[0].created_at)}
          endedAt={formatTime(promptQueue[0].expires_at)}
          counter={roundLabel(answeredRound, promptQueue.length)}
          onYes={() => answerVisited(promptQueue[0])}
          onNo={() => answerNotYet(promptQueue[0])}
        />
      )}

      {/* Prévia do card sendo arrastado (segue o dedo) */}
      {ghost && (
        <div
          ref={ghostEl}
          className="pointer-events-none fixed left-3 right-3 top-0 z-50 rounded-2xl border border-blue-600 bg-slate-900/95 px-3 py-3 text-sm font-semibold uppercase text-white shadow-xl"
          style={{ transform: `translateY(${ghost.y - 28}px)` }}
        >
          {ghost.name}
        </div>
      )}
    </div>
  );
}
