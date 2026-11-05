'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Doctor } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { STATUS_META } from '@/types/status';
import { TABS_NAVEGACAO, FILTROS_PLANTAO } from '@/constants';
import { parseDays, isRecentDoctor, getTodayDayCode } from '@/utils';

import LoginScreen from '@/components/LoginScreen';
import InstallBanner from '@/components/InstallBanner';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import DoctorCard from '@/components/DoctorCard';
import AddDoctorForm from '@/components/AddDoctorForm';

/* ── Helpers ── */

const REFRESH_INTERVAL = 30_000; // 30 s

function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function addMinutes(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
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

  /* Filters */
  const [selectedTab, setSelectedTab] = useState<string | null>(getTodayDayCode());
  const [turnoFilter, setTurnoFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('');

  /* UI */
  const [showAddForm, setShowAddForm] = useState(false);

  /* PWA install */
  const install = useInstallPrompt();

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
      // Busca a lista completa; filtros de dia/local/busca são aplicados no cliente
      // (evita erro de coluna inexistente antes da migração e permite filtro estrito por local)
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
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('doctor_statuses')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error) {
      // Tabela ainda não criada (migração SQL pendente) ou falha temporária: ignora sem quebrar a tela
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

  // Initial fetch + polling
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

      const record = {
        doctor_id: doctorId,
        status_type: type,
        expires_at: expiresAt,
        return_date: opts?.returnDate || null,
        rep_name: opts?.repName || null,
        created_by: session.user.id,
      };

      // Optimistic update
      const optimistic: DoctorStatus = {
        id: crypto.randomUUID(),
        ...record,
        created_at: new Date().toISOString(),
      };

      setStatusMap((prev) => {
        const existing = (prev[doctorId] || []).filter((s) => s.status_type !== type);
        return { ...prev, [doctorId]: [...existing, optimistic] };
      });

      const { error } = await supabase
        .from('doctor_statuses')
        .upsert(record, { onConflict: 'doctor_id,status_type' });

      if (error) {
        console.error('Erro ao setar status:', error.message, '|', error.details, '|', error.hint, '|', error.code);
        // Rollback
        setStatusMap((prev) => {
          const rolled = (prev[doctorId] || []).filter((s) => s.id !== optimistic.id);
          return { ...prev, [doctorId]: rolled };
        });
      } else {
        // Refresh to get server-assigned ID
        fetchStatuses();
      }
    },
    [session, fetchStatuses],
  );

  const clearDoctorStatus = useCallback(
    async (doctorId: string, type: DoctorStatusType) => {
      // Optimistic
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
        fetchStatuses(); // Refresh on error
      }
    },
    [fetchStatuses],
  );

  /* ═══════════════════ Doctor CRUD ═══════════════════ */

  const updateShift = useCallback(
    async (docId: string, newTurno: string, docName: string) => {
      // Optimistic
      setDoctors((prev) => prev.map((d) => (d.id === docId ? { ...d, turno: newTurno } : d)));

      const { error } = await supabase
        .from('doctors')
        .update({
          turno: newTurno,
          updated_by_name: session?.user.email?.split('@')[0] || 'App',
          change_source: 'app',
        })
        .eq('id', docId);

      if (error) {
        console.error('Erro ao atualizar turno:', error);
        fetchDoctors();
      }
    },
    [session, fetchDoctors],
  );

  const updateDoctor = useCallback(
    async (docId: string, data: Partial<Doctor>, docName: string): Promise<boolean> => {
      const { error } = await supabase
        .from('doctors')
        .update({
          ...data,
          updated_by_name: session?.user.email?.split('@')[0] || 'App',
          change_source: 'app',
        })
        .eq('id', docId);

      if (error) {
        console.error('Erro ao atualizar médico:', error);
        return false;
      }
      await fetchDoctors();
      return true;
    },
    [session, fetchDoctors],
  );

  const addDoctor = useCallback(
    async (data: Partial<Doctor>): Promise<boolean> => {
      const { error } = await supabase.from('doctors').insert({
        ...data,
        updated_by: session?.user.id || '',
        updated_by_name: session?.user.email?.split('@')[0] || 'App',
        change_source: 'app',
      });

      if (error) {
        console.error('Erro ao adicionar médico:', error);
        return false;
      }
      setShowAddForm(false);
      await fetchDoctors();
      return true;
    },
    [session, fetchDoctors],
  );

  const deleteDoctor = useCallback(
    async (doc: Doctor) => {
      if (!confirm(`Excluir ${doc.descricao}?`)) return;

      setDoctors((prev) => prev.filter((d) => d.id !== doc.id));

      const { error } = await supabase.from('doctors').delete().eq('id', doc.id);
      if (error) {
        console.error('Erro ao excluir médico:', error);
        fetchDoctors();
      }
    },
    [fetchDoctors],
  );

  /* ═══════════════════ Logout ═══════════════════ */

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  /* ═══════════════════ Sorting (category mode) ═══════════════════ */

  const isCategoryMode = selectedCategory !== null;

  // Cidades disponíveis (dos médicos cadastrados)
  const cities = useMemo(
    () =>
      Array.from(
        new Set(doctors.map((d) => (d.cidade || '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [doctors],
  );

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return doctors.filter((d) => {
      // Dia (null = sem filtro / lista global)
      if (selectedTab === 'novos') {
        if (!isRecentDoctor(d.created_at)) return false;
      } else if (selectedTab) {
        const days = parseDays(d.dias_semana || d.dia_semana);
        if (!days.includes(selectedTab)) return false;
      }

      // Local estrito: só quem tem PSM/SAMU/Hospital registrado como local de atuação
      if (selectedCategory) {
        const places = `${d.complemento || ''} ${d.descricao || ''}`.toLowerCase();
        const byCategory = d.categoria === selectedCategory;
        const byName = places.includes(selectedCategory === 'hospital' ? 'hospital' : selectedCategory);
        if (!byCategory && !byName) return false;
      }

      // Cidade
      if (selectedCity && (d.cidade || '').trim() !== selectedCity) return false;

      // Turno
      if (turnoFilter) {
        const t = d.turno || 'Manhã e Tarde';
        if (t !== turnoFilter && t !== 'Manhã e Tarde') return false;
      }

      // Busca
      if (q) {
        const hay = `${d.descricao} ${d.bairro} ${d.complemento} ${d.crm}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [doctors, selectedTab, selectedCategory, selectedCity, turnoFilter, searchQuery]);

  const sortedDoctors = isCategoryMode
    ? [...filteredDoctors].sort((a, b) => {
        const aVisited = (statusMap[a.id] || []).some((s) => s.status_type === 'visitado_hoje');
        const bVisited = (statusMap[b.id] || []).some((s) => s.status_type === 'visitado_hoje');
        // Visited goes to the bottom
        if (aVisited !== bVisited) return aVisited ? 1 : -1;
        return 0;
      })
    : filteredDoctors;

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
          <h1 className="text-base font-bold text-white m-0">Rota Propagandista</h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowAddForm((p) => !p)}
              className="bg-blue-600 text-white border-none px-2.5 py-1 rounded text-xs font-semibold hover:bg-blue-500"
            >
              + Novo
            </button>
            <button
              onClick={handleLogout}
              className="bg-transparent border border-slate-700 text-slate-400 px-2 py-1 rounded text-[11px] hover:text-white"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar médico, clínica, bairro, CRM..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full box-border p-2 rounded border border-slate-700 bg-slate-900 text-slate-100 text-xs outline-hidden placeholder:text-slate-500 mb-2"
        />

        {/* Filtro de cidade */}
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

        {/* Day Tabs */}
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
            </button>
          ))}
        </div>

        {/* Category Filter (PSM / SAMU / Hospital) */}
        <div className="flex gap-1 mt-1.5">
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

          {/* Turno filter */}
          <div className="ml-auto flex gap-0.5">
            {(['Manhã', 'Tarde'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTurnoFilter(turnoFilter === t ? null : t)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                  turnoFilter === t
                    ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                    : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
                }`}
              >
                {t === 'Manhã' ? '☀️' : '🌙'} {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Install Banner */}
      {install.showBanner && (
        <InstallBanner onInstall={install.install} onDismiss={install.dismiss} />
      )}

      {/* Main Content */}
      <main className="px-4 pt-3 flex flex-col gap-2.5">
        {/* Add Form */}
        {showAddForm && <AddDoctorForm onAdd={addDoctor} onCancel={() => setShowAddForm(false)} />}

        {/* Stats bar */}
        <div className="flex justify-between items-center text-[10px] text-slate-500">
          <span>
            {sortedDoctors.length} médico{sortedDoctors.length !== 1 ? 's' : ''}
            {selectedTab && selectedTab !== 'novos' && (
              <span> · {selectedTab.toUpperCase()}</span>
            )}
            {selectedCategory && <span> · {selectedCategory.toUpperCase()}</span>}
            {selectedCity && <span> · {selectedCity.toUpperCase()}</span>}
          </span>
          {loading && <span className="text-blue-400">Atualizando...</span>}
        </div>

        {/* Doctor Cards */}
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
              onUpdateShift={updateShift}
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
