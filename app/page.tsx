'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AddDoctorResult, Doctor, Shift } from '@/types/doctor';
import { ROUTE_EVENT_STATUSES } from '@/types/doctor';
import type { RouteTier } from '@/types/doctor';
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
    } catch { /* ignore */ }
  }, []);

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
    async (doctorId: string, type: DoctorStatusType, opts?: { repName?: string; returnDate?: string }) => {
      if (!session) return;
      const meta = STATUS_META[type];

      let expiresAt: string | null = null;
      if (meta.duration) expiresAt = addMinutes(meta.duration);
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

  /* ═══════════════════ Doctor CRUD ═══════════════════ */

  const updateDoctor = useCallback(
    async (docId: string, data: Partial<Doctor>, _docName: string): Promise<boolean> => {
      const { error } = await supabase
        .from('doctors')
        .update({ ...prepare(data), updated_by_name: actorName, change_source: 'app' })
        .eq('id', docId);

      if (error) {
        console.error('Erro ao atualizar médico:', error.message, '|', error.details, '|', error.code);
        return false;
      }
      await fetchDoctors();
      return true;
    },
    [prepare, actorName, fetchDoctors],
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

      const { error } = await supabase.from('doctors').insert({
        ...prepare(data),
        created_via: 'APP_FIELD',
        updated_by: session?.user.id || '',
        updated_by_name: actorName,
        change_source: 'app',
      });

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

      setShowAddForm(false);
      await fetchDoctors();
      return { ok: true };
    },
    [findDuplicate, prepare, session, actorName, fetchDoctors],
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

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const specSet = new Set(profile?.specialties ?? []);
    const citySet = new Set(selectedCities);

    return doctors.filter((d) => {
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
  }, [doctors, selectedTab, selectedCategory, selectedCities, turnoFilter, searchQuery, portfolioActive, profile, portfolio]);

  /* ═══════════════════ Ordenação em 3 blocos ═══════════════════
   * TOPO:  Último Paciente / Rep. no Consultório / Aguardando Médico (mais recente primeiro).
   * MEIO:  rota do dia — média histórica (todos os reps, por médico+dia+turno) ou ordem manual
   *        deste representante (rep_route_order), com ▲▼ e arrastar-e-soltar.
   * FIM:   Finalizou / Não veio / Licença / Viagem — esmaecidos.
   */
  const manualOrder = routeOrder[orderKey];
  const feed = useDoctorFilters({
    doctors: filteredDoctors,
    statusMap: liveStatusMap,
    events,
    routeDay,
    now,
    sortMode,
    manualOrder,
    categoryMode: isCategoryMode,
  });
  const { middleIds } = feed;
  const sortedDoctors = useMemo(() => [...feed.top, ...feed.middle, ...feed.bottom], [feed]);

  const applyMiddleOrder = useCallback(
    (visible: string[]) => {
      // Mantém a posição salva de médicos que estão fora do filtro atual
      const hidden = (manualOrder ?? []).filter((id) => !visible.includes(id));
      saveRouteOrder(orderKey, [...visible, ...hidden]);
    },
    [manualOrder, orderKey, saveRouteOrder],
  );

  const moveDoctor = useCallback(
    (docId: string, dir: -1 | 1) => {
      const idx = middleIds.indexOf(docId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= middleIds.length) return;
      const visible = [...middleIds];
      [visible[idx], visible[target]] = [visible[target], visible[idx]];
      applyMiddleOrder(visible);
    },
    [middleIds, applyMiddleOrder],
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

  const middleIndex = useMemo(() => new Map(middleIds.map((id, i) => [id, i])), [middleIds]);

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
        onMove={manual ? moveDoctor : undefined}
        isFirst={manual && pos === 0}
        isLast={manual && pos === middleIds.length - 1}
      />
    );
    if (!manual) return card;
    return (
      <div
        key={doc.id}
        draggable
        onDragStart={(e) => {
          dragId.current = doc.id;
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragOverId !== doc.id) setDragOverId(doc.id);
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
        className={`rounded-lg cursor-grab active:cursor-grabbing ${dragOverId === doc.id ? 'ring-2 ring-sky-500' : ''}`}
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
            {feed.top.length > 0 && (
              <SectionTitle tone="text-red-400">🔥 Em atendimento agora · {feed.top.length}</SectionTitle>
            )}
            {feed.top.map((doc) => renderCard(doc, 'top'))}

            {feed.middle.length > 0 && (feed.top.length > 0 || feed.bottom.length > 0) && (
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
    </div>
  );
}
