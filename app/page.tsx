'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { AddDoctorResult, Doctor, Shift } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { STATUS_META } from '@/types/status';
import { TABS_NAVEGACAO, FILTROS_PLANTAO, FILTROS_TURNO, OPCOES_DIAS, ESPECIALIDADES } from '@/constants';
import {
  agendaToDias,
  getAgenda,
  getTodayDayCode,
  isNewDoctor,
  matchesLocation,
  normalizeCrm,
  shiftCovers,
  specialtyCode,
} from '@/utils';
import { notifyCity } from '@/lib/push';

import LoginScreen from '@/components/LoginScreen';
import InstallBanner from '@/components/InstallBanner';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useRepProfile } from '@/hooks/useRepProfile';
import DoctorCard from '@/components/DoctorCard';
import AddDoctorForm from '@/components/AddDoctorForm';
import ProfileSettings from '@/components/ProfileSettings';

/* ── Helpers ── */

const REFRESH_INTERVAL = 30_000; // 30 s
const DUPLICATE_MSG = 'Médico já cadastrado na base de dados';

/** Status que fixam o card no topo e disparam push para a cidade */
const PINNED_STATUSES: DoctorStatusType[] = ['ultimo_paciente', 'representante_no_consultorio'];

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

/** Mantém dias_semana (coluna antiga) igual à agenda */
function withDerivedDays(data: Partial<Doctor>): Partial<Doctor> {
  return data.agenda ? { ...data, dias_semana: agendaToDias(data.agenda) } : data;
}

/* ── Page Component ── */

export default function HomePage() {
  /* Auth */
  const [session, setSession] = useState<{ user: { id: string; email?: string } } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* Data */
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, DoctorStatus[]>>({});
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /* Filters */
  const [selectedTab, setSelectedTab] = useState<string | null>(initialTab);
  const [turnoFilter, setTurnoFilter] = useState<Shift | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('');

  /* UI */
  const [showAddForm, setShowAddForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  /* PWA install */
  const install = useInstallPrompt();

  /* Perfil / carteira */
  const userId = session?.user.id ?? null;
  const { profile, portfolio, saveProfile, linkDoctor } = useRepProfile(userId);
  const actorName = profile?.display_name?.trim() || session?.user.email?.split('@')[0] || 'App';

  /* Interval ref */
  const statusInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ═══════════════════ Auth ═══════════════════ */

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  /* ═══════════════════ Fetch Doctors ═══════════════════ */

  const fetchDoctors = useCallback(async () => {
    if (!session) return;
    setLoading(true);

    try {
      // Lista completa; filtros rodam no cliente
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('descricao', { ascending: true });

      if (error) {
        console.error(
          'Erro ao buscar médicos:',
          error.message, '|', error.details, '|', error.hint, '|', error.code,
        );
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

  /* ═══════════════════ Fetch Statuses ═══════════════════ */

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

  // Busca inicial + polling
  useEffect(() => {
    fetchStatuses();

    if (statusInterval.current) clearInterval(statusInterval.current);
    statusInterval.current = setInterval(fetchStatuses, REFRESH_INTERVAL);

    return () => {
      if (statusInterval.current) clearInterval(statusInterval.current);
    };
  }, [fetchStatuses]);

  /* ═══════════════════ Status Actions ═══════════════════ */

  const setDoctorStatus = useCallback(
    async (
      doctorId: string,
      type: DoctorStatusType,
      opts?: { repName?: string; returnDate?: string },
    ) => {
      if (!session) return;
      const meta = STATUS_META[type];

      let expiresAt: string | null = null;
      if (meta.duration) {
        expiresAt = addMinutes(meta.duration);
      } else if (type === 'nao_veio_hoje' || type === 'visitado_hoje') {
        expiresAt = endOfToday();
      } else if (opts?.returnDate) {
        expiresAt = new Date(opts.returnDate + 'T23:59:59').toISOString();
      }

      const createdAt = new Date().toISOString();
      const record = {
        doctor_id: doctorId,
        status_type: type,
        // created_at explícito: no upsert de um status já existente o horário precisa renovar
        created_at: createdAt,
        expires_at: expiresAt,
        return_date: opts?.returnDate || null,
        rep_name: opts?.repName || actorName,
        created_by: session.user.id,
      };

      const optimistic: DoctorStatus = { id: crypto.randomUUID(), ...record };

      setStatusMap((prev) => {
        const existing = (prev[doctorId] || []).filter((s) => s.status_type !== type);
        return { ...prev, [doctorId]: [...existing, optimistic] };
      });
      setNow(Date.now());

      const { error } = await supabase
        .from('doctor_statuses')
        .upsert(record, { onConflict: 'doctor_id,status_type' });

      if (error) {
        console.error('Erro ao setar status:', error.message, '|', error.details, '|', error.hint, '|', error.code);
        setStatusMap((prev) => {
          const rolled = (prev[doctorId] || []).filter((s) => s.id !== optimistic.id);
          return { ...prev, [doctorId]: rolled };
        });
        return;
      }

      fetchStatuses();
      if (PINNED_STATUSES.includes(type)) notifyCity(doctorId, type);
    },
    [session, actorName, fetchStatuses],
  );

  const clearDoctorStatus = useCallback(
    async (doctorId: string, type: DoctorStatusType) => {
      setStatusMap((prev) => {
        const filtered = (prev[doctorId] || []).filter((s) => s.status_type !== type);
        return { ...prev, [doctorId]: filtered };
      });

      const { error } = await supabase
        .from('doctor_statuses')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('status_type', type);

      if (error) {
        console.error('Erro ao limpar status:', error.message, '|', error.details, '|', error.hint, '|', error.code);
        fetchStatuses();
      }
    },
    [fetchStatuses],
  );

  /* ═══════════════════ Doctor CRUD ═══════════════════ */

  const updateDoctor = useCallback(
    async (docId: string, data: Partial<Doctor>, _docName: string): Promise<boolean> => {
      const { error } = await supabase
        .from('doctors')
        .update({
          ...withDerivedDays(data),
          updated_by_name: actorName,
          change_source: 'app',
        })
        .eq('id', docId);

      if (error) {
        console.error('Erro ao atualizar médico:', error.message, '|', error.details, '|', error.code);
        return false;
      }
      await fetchDoctors();
      return true;
    },
    [actorName, fetchDoctors],
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
      // 1) Checagem local (lista completa já está carregada)
      const dup = findDuplicate(data.crm, data.uf);
      if (dup) return { ok: false, error: DUPLICATE_MSG, duplicate: dup };

      // 2) Insert — o índice único CRM+UF no banco é a garantia final
      const { error } = await supabase.from('doctors').insert({
        ...withDerivedDays(data),
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
          const found = (rows as Doctor[] | null)?.[0];
          return { ok: false, error: DUPLICATE_MSG, duplicate: found };
        }
        console.error('Erro ao adicionar médico:', error.message, '|', error.details, '|', error.code);
        return { ok: false, error: `Não foi possível adicionar: ${error.message}` };
      }

      setShowAddForm(false);
      await fetchDoctors();
      return { ok: true };
    },
    [findDuplicate, session, actorName, fetchDoctors],
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

  const cities = useMemo(
    () =>
      Array.from(new Set(doctors.map((d) => (d.cidade || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [doctors],
  );

  const newCount = useMemo(() => doctors.filter((d) => isNewDoctor(d)).length, [doctors]);

  // Carteira: especialidades escolhidas + médicos vinculados manualmente
  const mySpecialties = profile?.specialties ?? [];
  const portfolioConfigured = mySpecialties.length > 0 || portfolio.size > 0;
  const portfolioActive = Boolean(profile && !profile.show_all && portfolioConfigured);

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const specSet = new Set(profile?.specialties ?? []);

    return doctors.filter((d) => {
      const agenda = getAgenda(d);

      // Dia (null = lista global, sem filtro de dia)
      if (selectedTab === 'novos') {
        if (!isNewDoctor(d)) return false;
      } else if (selectedTab) {
        if (!agenda.some((e) => e.day === selectedTab)) return false;
      }

      // Local estrito: categoria ou campo de local; nunca o nome do médico
      if (selectedCategory && !matchesLocation(d, selectedCategory)) return false;

      // Cidade
      if (selectedCity && (d.cidade || '').trim() !== selectedCity) return false;

      // Turno: se há dia selecionado, vale o turno daquele dia
      if (turnoFilter) {
        const entries =
          selectedTab && selectedTab !== 'novos' ? agenda.filter((e) => e.day === selectedTab) : agenda;
        if (!entries.some((e) => shiftCovers(e.shift, turnoFilter))) return false;
      }

      // Minha carteira
      if (portfolioActive) {
        const code = specialtyCode(d.especialidade);
        if (!portfolio.has(d.id) && !(code && specSet.has(code))) return false;
      }

      // Busca
      if (q) {
        const hay = `${d.descricao} ${d.bairro} ${d.complemento} ${d.crm} ${d.especialidade ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [doctors, selectedTab, selectedCategory, selectedCity, turnoFilter, searchQuery, portfolioActive, profile, portfolio]);

  /* ═══════════════════ Ordenação ═══════════════════
   * 0. Último Paciente / Rep. no Consultório ativos (mais recente primeiro)
   * 1. Visitados — só nas abas PSM/SAMU/Hospitais (mais recente primeiro)
   * 2. Restante, em ordem alfabética
   */
  const sortedDoctors = useMemo(() => {
    const rankOf = (d: Doctor): { rank: number; ts: number } => {
      const live = (statusMap[d.id] || []).filter(
        (s) => !s.expires_at || new Date(s.expires_at).getTime() > now,
      );
      const pinned = live.filter((s) => PINNED_STATUSES.includes(s.status_type));
      if (pinned.length > 0) {
        return { rank: 0, ts: Math.max(...pinned.map((s) => new Date(s.created_at).getTime())) };
      }
      const visited = live.find((s) => s.status_type === 'visitado_hoje');
      if (isCategoryMode && visited) return { rank: 1, ts: new Date(visited.created_at).getTime() };
      return { rank: 2, ts: 0 };
    };

    return filteredDoctors
      .map((d) => ({ d, ...rankOf(d) }))
      .sort((a, b) => a.rank - b.rank || b.ts - a.ts)
      .map((x) => x.d);
  }, [filteredDoctors, statusMap, isCategoryMode, now]);

  const visitedCount = isCategoryMode
    ? sortedDoctors.filter((d) => (statusMap[d.id] || []).some((s) => s.status_type === 'visitado_hoje')).length
    : 0;

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
      {/* Sugestões de especialidade para os formulários */}
      <datalist id="lista-especialidades">
        {ESPECIALIDADES.map((e) => (
          <option key={e.code} value={e.label} />
        ))}
      </datalist>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-base font-bold text-white m-0">Rota Propagandista</h1>
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

        {/* Cidade */}
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          aria-label="Filtrar por cidade"
          className="w-full box-border p-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-xs outline-hidden mb-2"
        >
          <option value="">Todas as cidades</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </select>

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
      {install.showBanner && (
        <InstallBanner onInstall={install.install} onDismiss={install.dismiss} />
      )}

      {/* Perfil */}
      {showProfile && profile && userId && (
        <ProfileSettings
          userId={userId}
          profile={profile}
          cities={cities}
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
          />
        )}

        {/* Barra de contagem */}
        <div className="flex justify-between items-center text-[10px] text-slate-500">
          <span>
            {sortedDoctors.length} médico{sortedDoctors.length !== 1 ? 's' : ''}
            {selectedTab && selectedTab !== 'novos' && <span> · {selectedTab.toUpperCase()}</span>}
            {selectedCategory && <span> · {selectedCategory.toUpperCase()}</span>}
            {selectedCity && <span> · {selectedCity.toUpperCase()}</span>}
            {isCategoryMode && <span className="text-emerald-400"> · {visitedCount} visitado{visitedCount !== 1 ? 's' : ''}</span>}
          </span>
          {loading && <span className="text-blue-400">Atualizando...</span>}
        </div>

        {/* Cards */}
        {sortedDoctors.length === 0 && !loading ? (
          <div className="text-center text-slate-500 text-sm py-12">
            Nenhum médico encontrado para o filtro selecionado.
          </div>
        ) : (
          sortedDoctors.map((doc) => (
            <DoctorCard
              key={doc.id}
              doc={doc}
              statuses={statusMap[doc.id] || []}
              categoryMode={isCategoryMode}
              onUpdateDoctor={updateDoctor}
              onDeleteDoctor={deleteDoctor}
              onSetStatus={setDoctorStatus}
              onClearStatus={clearDoctorStatus}
            />
          ))
        )}
      </main>
    </div>
  );
}
