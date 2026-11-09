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
  getAgenda,
  getTodayDayCode,
  isNewDoctor,
  matchesLocation,
  normalizeCrm,
  shiftCovers,
  specialtyCode,
  ROUTE_HISTORY_DAYS,
} from '@/utils';
import { ensureServiceWorker, notifyCity } from '@/lib/push';

import LoginScreen from '@/components/LoginScreen';
import InstallBanner from '@/components/InstallBanner';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useRepProfile } from '@/hooks/useRepProfile';
import { useDoctorFilters } from '@/hooks/useDoctorFilters';
import type { SortMode } from '@/hooks/useDoctorFilters';
import DoctorCard from '@/components/DoctorCard';
import AddDoctorForm from '@/components/AddDoctorForm';
import ProfileSettings from '@/components/ProfileSettings';
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
const THEME_KEY = 'pharma_theme';

type Theme = 'onix' | 'marfim';

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

function isLive(s: Pick<DoctorStatus, 'expires_at'>, nowMs: number): boolean {
  return !s.expires_at || new Date(s.expires_at).getTime() > nowMs;
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

function SectionTitle({ tone, children }: { tone: string; children: ReactNode }) {
  return <div className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone}`}>{children}</div>;
}

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('historico');
  /** null = Todas as semanas do ciclo */
  const [selectedWeek, setSelectedWeek] = useState<CycleWeek | null>(null);
  /** "Estou visitando na": semana em que os visitados entram automaticamente */
  const [activeWeek, setActiveWeek] = useState<CycleWeek | null>(null);

  /* UI */
  const [showAddForm, setShowAddForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  /* PWA install */
  const install = useInstallPrompt();

  /* Perfil / carteira / ordem manual */
  const userId = session?.user.id ?? null;
  const { profile, portfolio, saveProfile, linkDoctor, routeOrder, saveRouteOrder } = useRepProfile(userId);
  const actorName = profile?.display_name?.trim() || session?.user.email?.split('@')[0] || 'App';

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

  /* Tema: Ônix (escuro, padrão) ou Marfim (claro). O layout já aplicou o salvo antes da pintura. */
  const [theme, setTheme] = useState<Theme>('onix');
  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') === 'marfim') setTheme('marfim');
  }, []);
  const toggleTheme = () => {
    const next: Theme = theme === 'onix' ? 'marfim' : 'onix';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'marfim' ? '#F6F4EF' : '#0B0B0D');
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch { /* ignore */ }
  };

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
      const week = normalizeCycleWeeks([Number(localStorage.getItem(CYCLE_WEEK_KEY))])[0];
      if (week) setSelectedWeek(week);
      const active = normalizeCycleWeeks([Number(localStorage.getItem(ACTIVE_WEEK_KEY))])[0];
      if (active) setActiveWeek(active);
    } catch { /* ignore */ }
  }, []);

  const changeActiveWeek = (week: CycleWeek | null) => {
    setActiveWeek(week);
    try {
      if (week) localStorage.setItem(ACTIVE_WEEK_KEY, String(week));
      else localStorage.removeItem(ACTIVE_WEEK_KEY);
    } catch { /* ignore */ }
  };

  const changeWeek = (week: CycleWeek | null) => {
    setSelectedWeek(week);
    try {
      if (week) localStorage.setItem(CYCLE_WEEK_KEY, String(week));
      else localStorage.removeItem(CYCLE_WEEK_KEY);
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
        setDoctors(data as Doctor[]);
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

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
    setStatusMap(map);
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
      else if (opts?.returnDate) expiresAt = new Date(opts.returnDate + 'T23:59:59').toISOString();

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

      // 2) Grava; o Realtime avisa os outros aparelhos
      const { error } = await supabase
        .from('doctor_statuses')
        .upsert(record, { onConflict: 'doctor_id,status_type' });

      if (error) {
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

      const { error } = await supabase
        .from('doctor_statuses')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('status_type', type);

      if (error) {
        console.error('Erro ao limpar status:', error.message, '|', error.details, '|', error.hint, '|', error.code);
        if (previous) setStatusMap((prev) => upsertStatus(prev, previous));
      }
    },
    [statusMap],
  );

  /* ═══════════════════ Cidades ═══════════════════ */

  const cityOptions = useMemo(() => buildCityOptions(doctors.map((d) => d.cidade)), [doctors]);
  const cityComboOptions: ComboOption[] = useMemo(
    () => cityOptions.map((o) => ({ value: o.label, label: o.label, hint: String(o.count) })),
    [cityOptions],
  );
  const cityLabels = useMemo(() => cityOptions.map((o) => o.label), [cityOptions]);

  /** Mantém dias_semana igual à agenda e grava a cidade na grafia oficial */
  const prepare = useCallback(
    (data: Partial<Doctor>): Partial<Doctor> => {
      const out: Partial<Doctor> = { ...data };
      if (data.agenda) out.dias_semana = agendaToDias(data.agenda);
      if (data.cidade !== undefined) out.cidade = canonicalCity(data.cidade, cityOptions);
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
      if (weeks !== undefined && !(await setDoctorWeeks(docId, weeks))) return false;
      if (Object.keys(fields).length === 0) return true;

      const { error } = await supabase
        .from('doctors')
        .update({ ...prepare(fields), updated_by_name: actorName, change_source: 'app' })
        .eq('id', docId);

      if (error) {
        console.error('Erro ao atualizar médico:', error.message, '|', error.details, '|', error.code);
        return false;
      }
      await fetchDoctors();
      return true;
    },
    [prepare, actorName, fetchDoctors, setDoctorWeeks],
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
      const { data: inserted, error } = await supabase
        .from('doctors')
        .insert({
          ...prepare(fields),
          created_via: 'APP_FIELD',
          updated_by: session?.user.id || '',
          updated_by_name: actorName,
          change_source: 'app',
        })
        .select('id')
        .single();

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
      const live = list.filter((s) => isLive(s, now));
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
  const cycleVisits = useMemo(() => {
    const out = new Map<string, string>();
    for (const [docId, list] of Object.entries(liveStatusMap)) {
      const v = list.find((s) => s.status_type === CYCLE_VISIT_STATUS && s.created_by === sessionUserId);
      if (v) out.set(docId, v.created_at);
    }
    return out;
  }, [liveStatusMap, sessionUserId]);

  /** Marca/desfaz "Visitado". Com semana ativa, o médico entra nela e fica na sequência da visita. */
  const toggleCycleVisit = useCallback(
    (doctorId: string, visited: boolean) => {
      if (!visited) {
        void clearDoctorStatus(doctorId, CYCLE_VISIT_STATUS);
        return;
      }
      void setDoctorStatus(doctorId, CYCLE_VISIT_STATUS, { persistent: true });

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
    [clearDoctorStatus, setDoctorStatus, activeWeek, routeOrder, cycleVisits, saveRouteOrder],
  );

  /** Novo ciclo: zera só os "Visitado" deste representante (semanas e ordem da rota ficam) */
  const renewCycle = useCallback(async () => {
    if (!sessionUserId) return;
    const ok = confirm(
      'Renovar o ciclo de visitas? Todos os médicos voltam para pendente. Semanas e ordem da rota continuam iguais.',
    );
    if (!ok) return;

    setStatusMap((prev) => {
      const next: Record<string, DoctorStatus[]> = {};
      for (const [docId, list] of Object.entries(prev)) {
        next[docId] = list.filter((s) => !(s.status_type === CYCLE_VISIT_STATUS && s.created_by === sessionUserId));
      }
      return next;
    });
    const { error } = await supabase
      .from('doctor_statuses')
      .delete()
      .eq('status_type', CYCLE_VISIT_STATUS)
      .eq('created_by', sessionUserId);
    if (error) {
      console.error('Erro ao renovar o ciclo:', error.message, '|', error.details, '|', error.code);
      alert('Não foi possível renovar o ciclo. Tente novamente.');
      fetchStatuses();
    }
  }, [sessionUserId, fetchStatuses]);

  /** Médicos com as semanas DESTE representante */
  const doctorsWithWeeks = useMemo(
    () => doctors.map((d) => ({ ...d, cycle_weeks: weeksByDoctor.get(d.id) ?? [] })),
    [doctors, weeksByDoctor],
  );

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
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

      if (q) {
        const hay = `${d.descricao} ${d.bairro} ${d.complemento} ${d.crm} ${d.especialidade ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [doctorsWithWeeks, selectedTab, selectedCategory, selectedCities, selectedWeek, turnoFilter, searchQuery, portfolioActive, profile, portfolio]);

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

  const applyMiddleOrder = useCallback(
    (visible: string[]) => {
      // Mantém a posição salva de médicos que estão fora do filtro atual
      const hidden = (manualOrder ?? []).filter((id) => !visible.includes(id));
      saveRouteOrder(manualKey, [...visible, ...hidden]);
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

  const cycleVisitedCount = filteredDoctors.filter((d) => cycleVisits.has(d.id)).length;

  const visitedCount = isCategoryMode
    ? sortedDoctors.filter((d) => (liveStatusMap[d.id] || []).some((s) => s.status_type === 'visitado_hoje')).length
    : 0;

  const cityLabelOf = (key: string) => cityOptions.find((o) => o.value === key)?.label ?? key;

  /* ═══════════════════ Layout: ficha aberta, próximo, barra de ações ═══════════════════ */

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const toggleExpand = useCallback((id: string) => setExpandedId((cur) => (cur === id ? null : id)), []);

  /** Próximo da rota: o primeiro do bloco do meio ainda não visitado */
  const nextDoctor = useMemo(
    () => (isCategoryMode ? null : feed.middle.find((d) => !cycleVisits.has(d.id)) ?? null),
    [isCategoryMode, feed.middle, cycleVisits],
  );
  /** A barra de baixo age sobre a ficha aberta; sem ficha aberta, sobre o próximo */
  const targetDoc = (expandedId ? sortedDoctors.find((d) => d.id === expandedId) : undefined) ?? nextDoctor;
  const targetVisited = targetDoc
    ? isCategoryMode
      ? (liveStatusMap[targetDoc.id] || []).some((s) => s.status_type === 'visitado_hoje')
      : cycleVisits.has(targetDoc.id)
    : false;
  const targetNav = targetDoc ? navigationUrl(targetDoc) : null;

  const toggleTargetVisited = () => {
    if (!targetDoc) return;
    if (isCategoryMode) {
      if (targetVisited) void clearDoctorStatus(targetDoc.id, 'visitado_hoje');
      else void setDoctorStatus(targetDoc.id, 'visitado_hoje');
    } else {
      toggleCycleVisit(targetDoc.id, !targetVisited);
    }
  };
  const openTargetStatus = () => {
    if (!targetDoc) return;
    setExpandedId(targetDoc.id);
    requestAnimationFrame(() =>
      document.getElementById(`doc-${targetDoc.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  };

  const activeFilterCount =
    (selectedCities.length > 0 ? 1 : 0) +
    (selectedWeek ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (turnoFilter ? 1 : 0) +
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
        cycleVisitedAt={isCategoryMode ? null : cycleVisits.get(doc.id) ?? null}
        onToggleCycleVisit={isCategoryMode ? undefined : toggleCycleVisit}
        activeWeekLabel={activeWeek ? cycleWeekLabel(activeWeek) : null}
        expanded={expandedId === doc.id}
        onToggleExpand={toggleExpand}
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 truncate">
              {dayLabel}
              {activeWeek ? ` · ${cycleWeekLabel(activeWeek)}` : ''}
            </span>
            <h1 className="m-0 flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              Rota de hoje
              <span
                title={realtimeOn ? 'Tempo real conectado' : 'Tempo real desconectado (atualiza a cada 8 s)'}
                className={`size-2 rounded-full ${realtimeOn ? 'bg-emerald-500' : 'bg-slate-600'}`}
              />
            </h1>
          </div>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={() => setShowAddForm((p) => !p)}
              aria-label="Novo médico"
              className="size-10 shrink-0 rounded-full border-0 bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'onix' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
              title={theme === 'onix' ? 'Tema claro (Marfim)' : 'Tema escuro (Ônix)'}
              className={iconBtn}
            >
              {theme === 'onix' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              )}
            </button>
            <button type="button" onClick={() => setShowProfile(true)} aria-label="Meu perfil" className={iconBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
            </button>
            <button type="button" onClick={handleLogout} aria-label="Sair" className={iconBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Busca + botão de filtros */}
        <div className="flex gap-2">
          <label className="flex-1 min-w-0 flex items-center gap-2 h-11 px-3.5 rounded-xl border border-slate-800 bg-slate-900">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-400" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              aria-label="Buscar"
              placeholder="Buscar médico, clínica, bairro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-0 border-0 bg-transparent text-base sm:text-sm text-slate-100 outline-hidden placeholder:text-slate-500"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
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

        {/* Dias (clicar de novo no dia ativo limpa o filtro) */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {TABS_NAVEGACAO.map((tab) => (
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
              {tab.value === 'novos' && newCount > 0 && (
                <span className="ml-1 rounded-full bg-green-600 px-1.5 text-[10px] text-white">{newCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Filtros recolhidos */}
        {showFilters && (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cidades</span>
              <CityFilter options={cityOptions} selected={selectedCities} onChange={setSelectedCities} />
            </div>

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
                    {f.emoji} {f.label}
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
                  {portfolioActive ? '🎯 Minha carteira' : '👥 Todos'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Turno e ordem</span>
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
                    {t.emoji} {t.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => changeSortMode(sortMode === 'historico' ? 'manual' : 'historico')}
                  title="Média histórica = horário médio de atendimento · Manual = a ordem que você arrasta"
                  className="h-8 px-3 rounded-full text-xs border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200"
                >
                  {sortMode === 'historico' ? '⏱ Ordem: média histórica' : '✋ Ordem: manual'}
                </button>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCities([]);
                  changeWeek(null);
                  setSelectedCategory(null);
                  setTurnoFilter(null);
                }}
                className="self-start h-8 px-3 rounded-full text-xs border border-slate-700 bg-transparent text-slate-300 hover:text-red-400"
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </header>

      {/* Install Banner */}
      {install.showBanner && <InstallBanner onInstall={install.install} onDismiss={install.dismiss} />}

      {/* Perfil */}
      {showProfile && profile && userId && (
        <ProfileSettings
          userId={userId}
          profile={profile}
          cities={cityLabels}
          onSave={saveProfile}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Conteúdo */}
      <main className="px-4 pt-4 pb-36 flex flex-col gap-2.5">
        {showAddForm && (
          <AddDoctorForm
            onAdd={addDoctor}
            onLinkPortfolio={linkDoctor}
            isInPortfolio={isInPortfolio}
            onCancel={() => setShowAddForm(false)}
            cityOptions={cityComboOptions}
          />
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
              onClick={() => toggleExpand(nextDoctor.id)}
              className="text-left bg-transparent border-0 p-0 flex flex-col gap-1"
            >
              <span className="text-lg font-semibold text-white">{nextDoctor.descricao}</span>
              <span className="text-sm text-slate-400">
                {[nextDoctor.complemento || 'Consultório próprio', nextDoctor.bairro].filter(Boolean).join(' · ')}
              </span>
            </button>
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm text-slate-200">
                {(() => {
                  const e = feed.expected.get(nextDoctor.id);
                  return e ? `${formatMinutes(e.startMinutes)} esperado` : 'Sem horário médio ainda';
                })()}
              </span>
              {navigationUrl(nextDoctor) && (
                <button
                  type="button"
                  onClick={() => {
                    const url = navigationUrl(nextDoctor);
                    if (url) openExternal(url);
                  }}
                  className="h-10 px-4 rounded-xl border-0 bg-blue-600 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-blue-500"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 11l18-8-8 18-2-8-8-2z" />
                  </svg>
                  Ir agora
                </button>
              )}
            </div>
          </section>
        )}

        {/* Ciclo de visitas */}
        {!isCategoryMode && (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Semana que estou visitando">
              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 mr-1">Estou visitando na</span>
              {CYCLE_WEEKS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => changeActiveWeek(activeWeek === w ? null : w)}
                  aria-pressed={activeWeek === w}
                  className={`h-8 px-3 rounded-full text-xs whitespace-nowrap shrink-0 ${
                    activeWeek === w ? 'border-0 bg-blue-600 text-white font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cycleWeekLabel(w)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                {selectedWeek ? `${cycleWeekLabel(selectedWeek)} · ` : 'Ciclo · '}
                <strong className="text-slate-100">{cycleVisitedCount}</strong> de {filteredDoctors.length} visitado
                {cycleVisitedCount !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={renewCycle}
                disabled={cycleVisits.size === 0}
                className="shrink-0 h-8 px-3 rounded-full border border-slate-700 bg-transparent text-xs font-medium text-slate-200 hover:text-white disabled:opacity-40"
              >
                🔄 Renovar ciclo
              </button>
            </div>
          </div>
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
          <span>{sortMode === 'historico' ? '⏱ Média histórica' : '✋ Ordem manual'}</span>
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
            {topDoctors.map((doc) => renderCard(doc, 'top'))}

            {feed.middle.length > 0 && (
              <SectionTitle tone="text-slate-400">Rota · {feed.middle.length}</SectionTitle>
            )}
            {feed.middle.map((doc) => renderCard(doc, 'middle'))}

            {feed.bottom.length > 0 && (
              <SectionTitle tone="text-slate-500">Visitados e indisponíveis · {feed.bottom.length}</SectionTitle>
            )}
            {feed.bottom.map((doc) => renderCard(doc, 'bottom'))}
          </>
        )}
        </FeedErrorBoundary>
      </main>

      {/* Barra de ações fixa (no alcance do polegar) */}
      {targetDoc && (
        <nav
          aria-label="Ações rápidas"
          className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
        >
          <div className="mx-auto max-w-xl rounded-[22px] border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-black/40 p-2 flex flex-col gap-1.5">
            <span className="px-2 text-[11px] text-slate-400 truncate">{targetDoc.descricao}</span>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l2.5 2" />
                </svg>
                Status
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Prévia do card sendo arrastado (segue o dedo) */}
      {ghost && (
        <div
          ref={ghostEl}
          className="pointer-events-none fixed left-3 right-3 top-0 z-50 rounded-2xl border border-blue-600 bg-slate-900/95 px-3 py-3 text-sm font-semibold uppercase text-white shadow-xl"
          style={{ transform: `translateY(${ghost.y - 28}px)` }}
        >
          ☰ {ghost.name}
        </div>
      )}
    </div>
  );
}
