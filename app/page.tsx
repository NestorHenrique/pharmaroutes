'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
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

function SectionTitle({ tone, children }: { tone: string; children: ReactNode }) {
  return <div className={`text-[10px] font-bold uppercase tracking-wide mt-1 ${tone}`}>{children}</div>;
}

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
        className={`rounded-lg cursor-grab active:cursor-grabbing ${dragOverId === doc.id ? 'ring-2 ring-sky-500' : ''} ${ghost?.id === doc.id ? 'opacity-40' : ''}`}
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
    <div className="min-h-dvh bg-slate-950 text-slate-100 pb-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-base font-bold text-white m-0 flex items-center gap-1.5">
            Rota Propagandista
            <span
              title={realtimeOn ? 'Tempo real conectado' : 'Tempo real desconectado (atualiza a cada 8 s)'}
              className={`size-2 rounded-full ${realtimeOn ? 'bg-emerald-500' : 'bg-slate-600'}`}
            />
          </h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowAddForm((p) => !p)}
              className="bg-blue-600 text-white border-none px-2.5 py-1 rounded text-xs font-semibold hover:bg-blue-500"
            >
              + Novo
            </button>
            <button
              onClick={() => setShowProfile(true)}
              aria-label="Meu perfil"
              className="bg-transparent border border-slate-700 text-slate-300 px-2 py-1 rounded text-[11px] hover:text-white"
            >
              ⚙️ Perfil
            </button>
            <button
              onClick={handleLogout}
              className="bg-transparent border border-slate-700 text-slate-400 px-2 py-1 rounded text-[11px] hover:text-white"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Busca */}
        <input
          type="text"
          placeholder="Buscar médico, clínica, bairro, CRM, especialidade..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full box-border p-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-xs outline-hidden placeholder:text-slate-500 mb-2"
        />

        {/* Cidades (busca + caixas de marcar) */}
        <CityFilter options={cityOptions} selected={selectedCities} onChange={setSelectedCities} />

        {/* Semanas do ciclo (logo abaixo das cidades) */}
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar mb-1.5" role="group" aria-label="Semana do ciclo">
          {[null, ...CYCLE_WEEKS].map((w) => (
            <button
              key={w ?? 'todas'}
              onClick={() => changeWeek(w)}
              aria-pressed={selectedWeek === w}
              className={`px-2.5 py-1.5 rounded text-[10px] font-bold border-none whitespace-nowrap shrink-0 ${
                selectedWeek === w ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-500 hover:text-slate-300'
              }`}
            >
              {w === null ? 'Todas' : cycleWeekLabel(w)}
            </button>
          ))}
        </div>

        {/* Dias (clicar de novo no dia ativo limpa o filtro) */}
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
          {TABS_NAVEGACAO.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSelectedTab(selectedTab === tab.value ? null : tab.value)}
              className={`px-2.5 py-1.5 rounded text-[10px] font-bold border-none whitespace-nowrap shrink-0 ${
                selectedTab === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.value === 'novos' && newCount > 0 && (
                <span className="ml-1 rounded-full bg-green-600 px-1 text-[9px] text-white">{newCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Local · carteira · turno */}
        <div className="flex gap-1 mt-1.5 flex-wrap items-center">
          {FILTROS_PLANTAO.map((f) => (
            <button
              key={f.value}
              onClick={() => setSelectedCategory(selectedCategory === f.value ? null : f.value)}
              className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                selectedCategory === f.value
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                  : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.emoji} {f.label}
            </button>
          ))}
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="px-2 py-1 rounded text-[10px] border border-slate-700 bg-slate-900 text-slate-500 hover:text-red-400"
            >
              ✕ Limpar
            </button>
          )}

          <button
            onClick={() => {
              if (!portfolioConfigured) {
                setShowProfile(true);
                return;
              }
              saveProfile({ show_all: !profile?.show_all });
            }}
            title={portfolioConfigured ? 'Alternar entre minha carteira e todos' : 'Escolha suas especialidades no perfil'}
            className={`px-2 py-1 rounded text-[10px] font-semibold border ${
              portfolioActive
                ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
          >
            {portfolioActive ? '🎯 Minha carteira' : '👥 Mostrando todos'}
          </button>

          <div className="ml-auto flex gap-0.5">
            {FILTROS_TURNO.map((t) => (
              <button
                key={t.value}
                onClick={() => setTurnoFilter(turnoFilter === t.value ? null : t.value)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                  turnoFilter === t.value
                    ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                    : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>
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
      <main className="px-4 pt-3 flex flex-col gap-2.5">
        {showAddForm && (
          <AddDoctorForm
            onAdd={addDoctor}
            onLinkPortfolio={linkDoctor}
            isInPortfolio={isInPortfolio}
            onCancel={() => setShowAddForm(false)}
            cityOptions={cityComboOptions}
          />
        )}

        {/* Ciclo de visitas */}
        {!isCategoryMode && (
          <div className="flex flex-col gap-2 rounded-lg border border-violet-500/40 bg-violet-950/30 px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Semana que estou visitando">
              <span className="text-[11px] text-violet-200 whitespace-nowrap shrink-0">Estou visitando na:</span>
              {CYCLE_WEEKS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => changeActiveWeek(activeWeek === w ? null : w)}
                  aria-pressed={activeWeek === w}
                  className={`px-2 py-1 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                    activeWeek === w
                      ? 'border-violet-400 bg-violet-600 text-white'
                      : 'border-violet-500/30 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cycleWeekLabel(w)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-violet-200">
                {selectedWeek ? `${cycleWeekLabel(selectedWeek)} · ` : 'Ciclo · '}
                <strong>{cycleVisitedCount}</strong> de {filteredDoctors.length} visitado{cycleVisitedCount !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={renewCycle}
                disabled={cycleVisits.size === 0}
                className="shrink-0 rounded border border-violet-400 bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
              >
                🔄 Renovar Ciclo de Visitas
              </button>
            </div>
          </div>
        )}

        {/* Contagem + modo de ordenação */}
        <div className="flex justify-between items-center gap-2 text-[10px] text-slate-500 flex-wrap">
          <span>
            {sortedDoctors.length} médico{sortedDoctors.length !== 1 ? 's' : ''}
            {selectedTab && selectedTab !== 'novos' && <span> · {selectedTab.toUpperCase()}</span>}
            {selectedCategory && <span> · {selectedCategory.toUpperCase()}</span>}
            {selectedCities.length > 0 && (
              <span> · {selectedCities.map((k) => cityLabelOf(k).toUpperCase()).join(', ')}</span>
            )}
            {isCategoryMode && (
              <span className="text-emerald-400">
                {' '}
                · {visitedCount} visitado{visitedCount !== 1 ? 's' : ''}
              </span>
            )}
            {loading && <span className="text-blue-400"> · Atualizando...</span>}
          </span>

          <div className="flex rounded-[5px] border border-slate-800 bg-slate-950 p-0.5" role="group" aria-label="Ordenação">
            <button
              onClick={() => changeSortMode('historico')}
              aria-pressed={sortMode === 'historico'}
              title="Ordena pelo horário médio em que o médico costuma atender (Último Paciente / Rep. no Consultório)"
              className={`px-2 py-[3px] rounded-sm text-[10px] ${
                sortMode === 'historico' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              ⏱ Média histórica
            </button>
            <button
              onClick={() => changeSortMode('manual')}
              aria-pressed={sortMode === 'manual'}
              title="Ordem que você define com ▲▼, salva por dia da semana"
              className={`px-2 py-[3px] rounded-sm text-[10px] ${
                sortMode === 'manual' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              ✋ Ordem manual
            </button>
          </div>
        </div>

        {/* Cards em 3 blocos */}
        {sortedDoctors.length === 0 && !loading ? (
          <div className="text-center text-slate-500 text-sm py-12">Nenhum médico encontrado para o filtro selecionado.</div>
        ) : (
          <>
            {topDoctors.length > 0 && (
              <SectionTitle tone="text-red-400">🔥 Em atendimento agora · {topDoctors.length}</SectionTitle>
            )}
            {topDoctors.map((doc) => renderCard(doc, 'top'))}

            {feed.middle.length > 0 && (topDoctors.length > 0 || feed.bottom.length > 0) && (
              <SectionTitle tone="text-sky-400">🧭 Rota do dia · {feed.middle.length}</SectionTitle>
            )}
            {feed.middle.map((doc) => renderCard(doc, 'middle'))}

            {feed.bottom.length > 0 && (
              <SectionTitle tone="text-slate-500">⚫ Indisponíveis / concluídos · {feed.bottom.length}</SectionTitle>
            )}
            {feed.bottom.map((doc) => renderCard(doc, 'bottom'))}
          </>
        )}
      </main>

      {/* Prévia do card sendo arrastado (segue o dedo) */}
      {ghost && (
        <div
          ref={ghostEl}
          className="pointer-events-none fixed left-3 right-3 top-0 z-50 rounded-lg border border-sky-400 bg-slate-800/95 px-3 py-3 text-sm font-semibold uppercase text-white shadow-xl"
          style={{ transform: `translateY(${ghost.y - 28}px)` }}
        >
          ☰ {ghost.name}
        </div>
      )}
    </div>
  );
}
