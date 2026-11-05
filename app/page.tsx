'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Doctor } from '@/types/doctor';
import { TABS_NAVEGACAO, OPCOES_DIAS } from '@/constants';
import { useDoctors } from '@/app/hooks/useDoctors';
import LoginForm from '@/app/components/auth/LoginForm';
import DoctorList from '@/app/components/doctors/DoctorList';
import { toggleDaySelection } from '@/utils/doctor';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  const [selectedTab, setSelectedTab] = useState<string>('seg');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { doctors, cities, loading, addDoctor, updateDoctor, updateShift, deleteDoctor } = useDoctors(user, selectedTab, selectedCity);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    descricao: '', crm: '', dias_semana: 'seg', cidade: 'PARNAIBA', bairro: '', endereco: '', numero: '', complemento: '', turno: 'Manhã e Tarde', observacoes: '', telefone: '', email: '', map_link: '',
  });
  const [gettingLocation, setGettingLocation] = useState<boolean>(false);

  useEffect(() => {
    const bannerDismissed = sessionStorage.getItem('pwa_banner_dismissed');
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphone = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIphone);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (!isStandalone && !bannerDismissed) {
      if (isIphone) {
        setShowInstallBanner(true);
      } else {
        window.addEventListener('beforeinstallprompt', (e: any) => {
          e.preventDefault();
          setDeferredPrompt(e);
          setShowInstallBanner(true);
        });
      }
    }
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') setShowInstallBanner(false);
        setDeferredPrompt(null);
      });
    } else if (isIOS) {
      alert('Para instalar no iPhone:\n\n1. Toque no botão "Compartilhar".\n2. Selecione "Adicionar à Tela de Início".');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Erro ao aceder: ' + error.message);
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctor.descricao) return;
    
    const success = await addDoctor(newDoctor);
    if (success) {
      setShowAddForm(false);
      setNewDoctor({ descricao: '', crm: '', dias_semana: selectedTab !== 'novos' ? selectedTab : 'seg', cidade: selectedCity !== 'ALL' ? selectedCity : 'PARNAIBA', bairro: '', endereco: '', numero: '', complemento: '', turno: 'Manhã e Tarde', observacoes: '', telefone: '', email: '', map_link: '' });
    }
  };

  const getCurrentLocation = (onSuccess: (url: string) => void) => {
    if (!navigator.geolocation) return alert('Geolocalização não suportada.');
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSuccess(`https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`);
        setGettingLocation(false);
      },
      () => setGettingLocation(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!user) {
    return (
      <div style={{ padding: '20px' }}>
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }

  const filteredDoctors = doctors.filter((doc) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = doc.descricao?.toLowerCase().includes(term) || doc.bairro?.toLowerCase().includes(term) || doc.complemento?.toLowerCase().includes(term) || doc.observacoes?.toLowerCase().includes(term) || doc.telefone?.toLowerCase().includes(term);
    const docShift = doc.turno || 'Manhã e Tarde';
    const matchesShift = selectedShiftFilter === 'ALL' || docShift === selectedShiftFilter || docShift === 'Manhã e Tarde';
    return matchesSearch && matchesShift;
  });

  return (
    <div style={{ backgroundColor: '#09090b', minHeight: '100vh', color: '#f4f4f5', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {showInstallBanner && (
        <div style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
          <div><div style={{ fontSize: '12px', fontWeight: 700 }}>PharmaRoutes</div></div>
          <button onClick={handleInstallClick} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px' }}>Salvar na Tela</button>
        </div>
      )}

      <header style={{ borderBottom: '1px solid #18181b', backgroundColor: '#09090b', padding: '12px 20px', position: 'sticky', top: showInstallBanner ? '53px' : 0, zIndex: 10 }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>PharmaRoutes</h1>
            <span style={{ fontSize: '10px', color: '#71717a' }}>{user.email}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowAddForm(!showAddForm)} style={{ backgroundColor: showAddForm ? '#27272a' : '#2563eb', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px' }}>
              {showAddForm ? 'Cancelar' : '+ Médico'}
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ backgroundColor: 'transparent', color: '#f87171', border: '1px solid #27272a', padding: '5px 8px', borderRadius: '6px', fontSize: '11px' }}>Sair</button>
          </div>
        </div>
      </header>

      <main style={{ padding: '16px 14px', maxWidth: '640px', margin: '0 auto' }}>
        
        {/* Aqui renderiza o formulário de cadastro. Se quiser, pode extrair depois para AddDoctorForm.tsx */}
        {showAddForm && (
           <form onSubmit={handleCreateDoctor} style={{ backgroundColor: '#121215', border: '1px solid #27272a', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
             <input type="text" required placeholder="Nome do Médico *" value={newDoctor.descricao} onChange={e => setNewDoctor({...newDoctor, descricao: e.target.value})} style={{ padding: '8px', backgroundColor: '#09090b', color: '#fff', borderRadius: '6px', border: '1px solid #27272a' }} />
             <div style={{ display: 'flex', gap: '4px' }}>
                {OPCOES_DIAS.map(d => {
                  const isChecked = (newDoctor.dias_semana || '').toLowerCase().includes(d.value);
                  return <button type="button" key={d.value} onClick={() => setNewDoctor({ ...newDoctor, dias_semana: toggleDaySelection(newDoctor.dias_semana, d.value) })} style={{ flex: 1, padding: '5px 0', border: isChecked ? '1px solid #3b82f6' : '1px solid #27272a', backgroundColor: isChecked ? '#1d4ed8' : '#09090b', color: isChecked ? '#fff' : '#71717a' }}>{d.label}</button>
                })}
             </div>
             <button type="button" onClick={() => getCurrentLocation(url => setNewDoctor(p => ({...p, map_link: url})))} style={{ padding: '8px', backgroundColor: '#15803d', color: '#fff', border: 'none', borderRadius: '6px' }}>{gettingLocation ? '...' : 'Pegar GPS'}</button>
             <button type="submit" style={{ padding: '8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px' }}>Salvar Cadastro</button>
           </form>
        )}

        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#121215', padding: '3px', borderRadius: '8px', marginBottom: '14px' }}>
          {TABS_NAVEGACAO.map((tab) => (
            <button key={tab.value} onClick={() => setSelectedTab(tab.value)} style={{ flex: 1, padding: '7px 0', borderRadius: '6px', border: 'none', backgroundColor: selectedTab === tab.value ? '#2563eb' : 'transparent', color: selectedTab === tab.value ? '#fff' : '#71717a' }}>{tab.label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={{ padding: '8px', backgroundColor: '#121215', color: '#d4d4d8', borderRadius: '6px', border: '1px solid #1f1f23' }}>
            <option value="ALL">Todas as Cidades</option>
            {cities.map(city => <option key={city} value={city}>{city.toUpperCase()}</option>)}
          </select>
          <select value={selectedShiftFilter} onChange={e => setSelectedShiftFilter(e.target.value)} style={{ padding: '8px', backgroundColor: '#121215', color: '#d4d4d8', borderRadius: '6px', border: '1px solid #1f1f23' }}>
            <option value="ALL">Todos os Turnos</option><option value="Manhã">Apenas Manhã</option><option value="Tarde">Apenas Tarde</option><option value="Manhã e Tarde">Integral</option>
          </select>
        </div>

        <input type="text" placeholder="Buscar por médico..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', backgroundColor: '#121215', color: '#f4f4f5', border: '1px solid #1f1f23', marginBottom: '14px', boxSizing: 'border-box' }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#71717a' }}>Carregando roteiro...</div>
        ) : filteredDoctors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#71717a' }}>Nenhum médico encontrado.</div>
        ) : (
          <DoctorList 
            doctors={filteredDoctors}
            onUpdateShift={updateShift}
            onUpdateDoctor={updateDoctor}
            onDeleteDoctor={deleteDoctor}
            toggleDaySelection={toggleDaySelection}
          />
        )}
      </main>
    </div>
  );
}