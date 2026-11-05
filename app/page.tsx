'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Doctor } from '@/types/doctor';
import { TABS_NAVEGACAO } from '@/constants';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import InstallBanner from '@/components/InstallBanner';
import LoginScreen from '@/components/LoginScreen';
import AddDoctorForm from '@/components/AddDoctorForm';
import DoctorCard from '@/components/DoctorCard';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const { showBanner, install, dismiss } = useInstallPrompt();

  const [selectedTab, setSelectedTab] = useState('seg');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const requestId = useRef(0);

  /* ---------------- Sessão ---------------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ---------------- Dados ---------------- */
  const loadCities = useCallback(async () => {
    const { data, error } = await supabase.from('doctors').select('cidade');
    if (!error && data) {
      const unique = Array.from(
        new Set(data.map((item: { cidade: string | null }) => item.cidade).filter(Boolean)),
      ).sort();
      setCities(unique as string[]);
    }
  }, []);

  useEffect(() => {
    if (user) loadCities();
  }, [user, loadCities]);

  const fetchDoctors = useCallback(async () => {
    if (!user) return;
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);

    let query = supabase.from('doctors').select('*');

    if (selectedTab === 'novos') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });
    } else {
      query = query
        .or(`dias_semana.ilike.%${selectedTab}%,dia_semana.ilike.%${selectedTab}%`)
        .order('bairro', { ascending: true });
    }

    if (selectedCity !== 'ALL') query = query.eq('cidade', selectedCity);

    const { data, error } = await query;
    if (id !== requestId.current) return;

    if (error) setLoadError('Não foi possível carregar o roteiro. Tente novamente.');
    else setDoctors((data as Doctor[]) ?? []);
    setLoading(false);
  }, [user, selectedTab, selectedCity]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  /* ---------------- Ações ---------------- */
  const logActivity = useCallback(
    async (actionType: 'INSERT' | 'UPDATE' | 'DELETE', doctorName: string, details: string) => {
      if (!user) return;
      await supabase.from('activity_logs').insert([
        { user_email: user.email, action_type: actionType, doctor_name: doctorName, details },
      ]);
    },
    [user],
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDeleteDoctor = useCallback(
    async (doc: Doctor) => {
      if (!window.confirm(`Deseja remover "${doc.descricao}"? Esta ação ficará gravada no seu utilizador.`))
        return;

      setDoctors((prev) => prev.filter((d) => d.id !== doc.id));
      const { error } = await supabase.from('doctors').delete().eq('id', doc.id);

      if (!error) await logActivity('DELETE', doc.descricao || 'Sem nome', `Removido por ${user?.email}`);
      else fetchDoctors();
    },
    [user, logActivity, fetchDoctors],
  );

  const handleCreateDoctor = useCallback(
    async (data: Partial<Doctor>): Promise<boolean> => {
      setCreating(true);
      const payload = {
        ...data,
        dia_semana: data.dias_semana,
        created_at: new Date().toISOString(),
        updated_by: user?.email,
      };

      const { error } = await supabase.from('doctors').insert([payload]);
      setCreating(false);
      if (error) return false;

      await logActivity('INSERT', data.descricao || '', `Cadastrado por ${user?.email}`);
      setShowAddForm(false);
      fetchDoctors();
      loadCities();
      return true;
    },
    [user, logActivity, fetchDoctors, loadCities],
  );

  const handleUpdateShift = useCallback(
    async (docId: string, newTurno: string, docName: string) => {
      setDoctors((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, turno: newTurno, updated_by: user?.email } : d)),
      );

      const { error } = await supabase
        .from('doctors')
        .update({ turno: newTurno, updated_by: user?.email })
        .eq('id', docId);

      if (error) {
        fetchDoctors();
        return;
      }
      await logActivity('UPDATE', docName, `Turno alterado para ${newTurno} por ${user?.email}`);
    },
    [user, logActivity, fetchDoctors],
  );

  const handleUpdateDoctor = useCallback(
    async (docId: string, data: Partial<Doctor>, docName: string): Promise<boolean> => {
      const updatedData = { ...data, dia_semana: data.dias_semana, updated_by: user?.email };
      const { error } = await supabase.from('doctors').update(updatedData).eq('id', docId);
      if (error) return false;

      await logActivity('UPDATE', docName, `Dados atualizados por ${user?.email}`);
      setDoctors((prev) => prev.map((d) => (d.id === docId ? { ...d, ...updatedData } : d)));
      return true;
    },
    [user, logActivity],
  );

  /* ---------------- Render ---------------- */
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xs text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  const term = searchTerm.toLowerCase();
  const filteredDoctors = doctors.filter((doc) => {
    const textMatch = [doc.descricao, doc.bairro, doc.complemento, doc.observacoes, doc.telefone].some(
      (v) => v?.toLowerCase().includes(term),
    );
    const docShift = doc.turno || 'Manhã e Tarde';
    const shiftMatch =
      selectedShiftFilter === 'ALL' || docShift === selectedShiftFilter || docShift === 'Manhã e Tarde';
    return textMatch && shiftMatch;
  });

  return (
    <div className="min-h-screen">
      {showBanner && <InstallBanner onInstall={install} onDismiss={dismiss} />}

      {/* Header fixo */}
      <header
        className={`border-b border-slate-800 bg-slate-950/90 px-5 py-3 sticky z-10 backdrop-blur-sm ${
          showBanner ? 'top-[53px]' : 'top-0'
        }`}
      >
        <div className="max-w-[640px] mx-auto flex justify-between items-center">
          <div>
            <h1 className="m-0 text-base font-bold text-white">PharmaRoutes</h1>
            <span className="text-[10px] text-slate-500">{user.email}</span>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className={`text-white border-none px-2.5 py-1.5 rounded-md text-[11px] font-semibold ${
                showAddForm ? 'bg-slate-700' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {showAddForm ? 'Cancelar' : '+ Médico'}
            </button>
            <button
              onClick={handleLogout}
              className="bg-transparent text-red-300 border border-slate-700 px-2 py-[5px] rounded-md text-[11px] hover:bg-slate-800"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="px-3.5 py-4 max-w-[640px] mx-auto">
        {showAddForm && (
          <AddDoctorForm
            defaultDay={selectedTab !== 'novos' ? selectedTab : 'seg'}
            defaultCity={selectedCity !== 'ALL' ? selectedCity : 'PARNAIBA'}
            saving={creating}
            onSubmit={handleCreateDoctor}
          />
        )}

        {/* Tabs de dias */}
        <div className="flex gap-1 bg-slate-900 p-[3px] rounded-lg mb-3.5 border border-slate-800">
          {TABS_NAVEGACAO.map((tab) => {
            const isNovos = tab.value === 'novos';
            const isSelected = selectedTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setSelectedTab(tab.value)}
                className={`flex-1 py-[7px] rounded-md border-none text-[11px] ${
                  isSelected
                    ? isNovos
                      ? 'bg-green-700 text-white font-bold'
                      : 'bg-blue-600 text-white font-bold'
                    : isNovos
                      ? 'bg-transparent text-green-400 font-medium'
                      : 'bg-transparent text-slate-500 font-medium hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full px-2.5 py-2 rounded-md border border-slate-800 bg-slate-900 text-slate-300 text-xs outline-hidden"
          >
            <option value="ALL">Todas as Cidades</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={selectedShiftFilter}
            onChange={(e) => setSelectedShiftFilter(e.target.value)}
            className="w-full px-2.5 py-2 rounded-md border border-slate-800 bg-slate-900 text-slate-300 text-xs outline-hidden"
          >
            <option value="ALL">Todos os Turnos</option>
            <option value="Manhã">Apenas Manhã</option>
            <option value="Tarde">Apenas Tarde</option>
            <option value="Manhã e Tarde">Integral</option>
          </select>
        </div>

        {/* Busca */}
        <div className="mb-3.5">
          <input
            type="text"
            placeholder="Buscar por médico, clínica, bairro ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border border-slate-800 bg-slate-900 text-slate-100 text-xs outline-hidden box-border placeholder:text-slate-500"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs">Carregando roteiro...</div>
        ) : loadError ? (
          <div
            role="alert"
            className="text-center py-8 text-red-300 bg-slate-900 rounded-lg border border-slate-800 text-xs"
          >
            {loadError}{' '}
            <button onClick={fetchDoctors} className="bg-transparent border-none text-blue-400 underline text-xs">
              Tentar de novo
            </button>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            Nenhum médico encontrado.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredDoctors.map((doc) => (
              <DoctorCard
                key={doc.id}
                doc={doc}
                onUpdateShift={handleUpdateShift}
                onUpdateDoctor={handleUpdateDoctor}
                onDeleteDoctor={handleDeleteDoctor}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
