'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface Doctor {
  id: string;
  crm?: string;
  descricao?: string;
  dia_semana?: string;
  dias_semana?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  turno?: string;
  observacoes?: string;
  telefone?: string;
  email?: string;
  map_link?: string;
  created_at?: string;
  updated_by?: string;
}

const TABS_NAVEGACAO = [
  { label: 'SEG', value: 'seg' },
  { label: 'TER', value: 'ter' },
  { label: 'QUA', value: 'qua' },
  { label: 'QUI', value: 'qui' },
  { label: 'SEX', value: 'sex' },
  { label: 'NOVOS', value: 'novos' },
];

const OPCOES_DIAS = [
  { label: 'SEG', value: 'seg' },
  { label: 'TER', value: 'ter' },
  { label: 'QUA', value: 'qua' },
  { label: 'QUI', value: 'qui' },
  { label: 'SEX', value: 'sex' },
];

const OPCOES_TURNO = ['Manhã', 'Tarde', 'Manhã e Tarde'];

const isRecentDoctor = (createdAt?: string) => {
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  const now = new Date();
  return (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24) <= 7;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Estados do Popup de Atalho/Instalação PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  const [selectedTab, setSelectedTab] = useState<string>('seg');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cities, setCities] = useState<string[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [gettingLocation, setGettingLocation] = useState<boolean>(false);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    descricao: '',
    crm: '',
    dias_semana: 'seg',
    cidade: 'PARNAIBA',
    bairro: '',
    endereco: '',
    numero: '',
    complemento: '',
    turno: 'Manhã e Tarde',
    observacoes: '',
    telefone: '',
    email: '',
    map_link: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Doctor>>({});

  // Detectar suporte a PWA / Instalação na Tela Inicial
  useEffect(() => {
    // Verificar se já fechou o banner anteriormente nesta sessão
    const bannerDismissed = sessionStorage.getItem('pwa_banner_dismissed');
    
    // Verificar se é iOS (iPhone/iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphone = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIphone);

    // Verificar se o app já está rodando em modo Standalone (já instalado)
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
        if (choiceResult.outcome === 'accepted') {
          setShowInstallBanner(false);
        }
        setDeferredPrompt(null);
      });
    } else if (isIOS) {
      alert('Para instalar no iPhone:\n\n1. Toque no botão de "Compartilhar" (ícone com quadrado e seta para cima no rodapé do Safari).\n2. Selecione "Adicionar à Tela de Início".');
    }
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  // Verificar sessão do utilizador
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function loadCities() {
      const { data, error } = await supabase.from('doctors').select('cidade');
      if (!error && data) {
        const uniqueCities = Array.from(
          new Set(data.map((item) => item.cidade).filter(Boolean))
        ).sort();
        setCities(uniqueCities as string[]);
      }
    }
    loadCities();
  }, [user]);

  const fetchDoctors = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase.from('doctors').select('*');

    if (selectedTab === 'novos') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query.gte('created_at', sevenDaysAgo.toISOString()).order('created_at', { ascending: false });
    } else {
      query = query.or(`dias_semana.ilike.%${selectedTab}%,dia_semana.ilike.%${selectedTab}%`).order('bairro', { ascending: true });
    }

    if (selectedCity !== 'ALL') {
      query = query.eq('cidade', selectedCity);
    }

    const { data, error } = await query;
    if (!error) setDoctors(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchDoctors();
  }, [selectedTab, selectedCity, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) alert('Erro ao aceder: ' + error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const logActivity = async (actionType: 'INSERT' | 'UPDATE' | 'DELETE', doctorName: string, details: string) => {
    if (!user) return;
    await supabase.from('activity_logs').insert([
      {
        user_email: user.email,
        action_type: actionType,
        doctor_name: doctorName,
        details: details,
      },
    ]);
  };

  const getCurrentLocation = (onSuccess: (url: string) => void) => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada no seu dispositivo.');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const mapsUrl = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
        onSuccess(mapsUrl);
        setGettingLocation(false);
        alert('Localização obtida via GPS!');
      },
      () => {
        alert('Erro ao capturar GPS.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleDaySelection = (currentDaysString: string = '', dayValue: string) => {
    const daysArray = currentDaysString.toLowerCase().split(',').map(d => d.trim()).filter(Boolean);
    const updatedArray = daysArray.includes(dayValue)
      ? daysArray.filter(d => d !== dayValue)
      : [...daysArray, dayValue];
    return updatedArray.join(', ');
  };

  const handleDeleteDoctor = async (doc: Doctor) => {
    if (!window.confirm(`Deseja remover "${doc.descricao}"? Esta ação ficará gravada no seu utilizador.`)) return;
    
    setDoctors((prev) => prev.filter((d) => d.id !== doc.id));
    const { error } = await supabase.from('doctors').delete().eq('id', doc.id);

    if (!error) {
      await logActivity('DELETE', doc.descricao || 'Sem nome', `Removido por ${user?.email}`);
    } else {
      fetchDoctors();
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctor.descricao) return;

    setLoading(true);
    const payload = {
      ...newDoctor,
      dia_semana: newDoctor.dias_semana,
      created_at: new Date().toISOString(),
      updated_by: user?.email,
    };

    const { error } = await supabase.from('doctors').insert([payload]);

    if (!error) {
      await logActivity('INSERT', newDoctor.descricao, `Cadastrado por ${user?.email}`);
      setShowAddForm(false);
      setNewDoctor({
        descricao: '',
        crm: '',
        dias_semana: selectedTab !== 'novos' ? selectedTab : 'seg',
        cidade: selectedCity !== 'ALL' ? selectedCity : 'PARNAIBA',
        bairro: '',
        endereco: '',
        numero: '',
        complemento: '',
        turno: 'Manhã e Tarde',
        observacoes: '',
        telefone: '',
        email: '',
        map_link: '',
      });
      fetchDoctors();
    }
    setLoading(false);
  };

  const handleUpdateShift = async (docId: string, newTurno: string) => {
    const doc = doctors.find(d => d.id === docId);
    setDoctors((prev) => prev.map((d) => (d.id === docId ? { ...d, turno: newTurno, updated_by: user?.email } : d)));
    
    await supabase.from('doctors').update({ turno: newTurno, updated_by: user?.email }).eq('id', docId);
    await logActivity('UPDATE', doc?.descricao || '', `Turno alterado para ${newTurno} por ${user?.email}`);
  };

  const handleStartEdit = (doc: Doctor) => {
    setEditingId(doc.id);
    setEditForm({
      dias_semana: doc.dias_semana || doc.dia_semana || '',
      complemento: doc.complemento || '',
      endereco: doc.endereco || '',
      numero: doc.numero || '',
      bairro: doc.bairro || '',
      observacoes: doc.observacoes || '',
      telefone: doc.telefone || '',
      email: doc.email || '',
      map_link: doc.map_link || '',
    });
  };

  const handleSaveEdit = async (docId: string) => {
    const doc = doctors.find(d => d.id === docId);
    const updatedData = { ...editForm, dia_semana: editForm.dias_semana, updated_by: user?.email };
    const { error } = await supabase.from('doctors').update(updatedData).eq('id', docId);

    if (!error) {
      await logActivity('UPDATE', doc?.descricao || '', `Dados atualizados por ${user?.email}`);
      setDoctors((prev) => prev.map((d) => (d.id === docId ? { ...d, ...updatedData } : d)));
      setEditingId(null);
    }
  };

  const openNavigation = (doc: Doctor) => {
    if (doc.map_link?.trim()) {
      window.open(doc.map_link, '_blank');
    } else {
      const fullAddress = `${doc.endereco}, ${doc.numero || 'SN'}, ${doc.bairro || ''}, ${doc.cidade || ''}`;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`, '_blank');
    }
  };

  const openWhatsApp = (phone?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  if (!user) {
    return (
      <div style={{ backgroundColor: '#09090b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: '#121215', border: '1px solid #1f1f23', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>PharmaRoutes</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#71717a' }}>Acesso Restrito ao Roteiro</p>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>E-mail</label>
            <input
              type="email"
              required
              placeholder="seu@email.com"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Palavra-passe</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
          >
            {authLoading ? 'A entrar...' : 'Entrar na Plataforma'}
          </button>
        </form>
      </div>
    );
  }

  const filteredDoctors = doctors.filter((doc) => {
    const term = searchTerm.toLowerCase();
    const nameMatch = doc.descricao?.toLowerCase().includes(term);
    const bairroMatch = doc.bairro?.toLowerCase().includes(term);
    const complementoMatch = doc.complemento?.toLowerCase().includes(term);
    const obsMatch = doc.observacoes?.toLowerCase().includes(term);
    const phoneMatch = doc.telefone?.toLowerCase().includes(term);

    const docShift = doc.turno || 'Manhã e Tarde';
    const shiftMatch =
      selectedShiftFilter === 'ALL' ||
      docShift === selectedShiftFilter ||
      docShift === 'Manhã e Tarde';

    return (nameMatch || bairroMatch || complementoMatch || obsMatch || phoneMatch) && shiftMatch;
  });

  return (
    <div style={{ backgroundColor: '#09090b', minHeight: '100vh', color: '#f4f4f5', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* POPUP / BANNER DE INSTALAÇÃO NA TELA INICIAL */}
      {showInstallBanner && (
        <div style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', color: '#fff' }}>
              P
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>Facilite seu trabalho em campo</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Adicione o PharmaRoutes no seu celular</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleInstallClick}
              style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              Salvar na Tela
            </button>
            <button
              onClick={handleDismissBanner}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header Fixo */}
      <header style={{ borderBottom: '1px solid #18181b', backgroundColor: '#09090b', padding: '12px 20px', position: 'sticky', top: showInstallBanner ? '53px' : 0, zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>PharmaRoutes</h1>
            <span style={{ fontSize: '10px', color: '#71717a' }}>{user.email}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ backgroundColor: showAddForm ? '#27272a' : '#2563eb', color: '#ffffff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              {showAddForm ? 'Cancelar' : '+ Médico'}
            </button>
            <button
              onClick={handleLogout}
              style={{ backgroundColor: 'transparent', color: '#f87171', border: '1px solid #27272a', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: '16px 14px', maxWidth: '640px', margin: '0 auto' }}>
        
        {/* Form de Cadastro */}
        {showAddForm && (
          <form
            onSubmit={handleCreateDoctor}
            style={{ backgroundColor: '#121215', border: '1px solid #27272a', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <h3 style={{ margin: 0, fontSize: '14px', color: '#60a5fa', fontWeight: 600 }}>Cadastrar Novo Médico</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <input
                type="text"
                required
                placeholder="Nome do Médico *"
                value={newDoctor.descricao}
                onChange={(e) => setNewDoctor({ ...newDoctor, descricao: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
              <input
                type="text"
                placeholder="CRM"
                value={newDoctor.crm}
                onChange={(e) => setNewDoctor({ ...newDoctor, crm: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Dias de Atendimento:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {OPCOES_DIAS.map((d) => {
                  const isChecked = (newDoctor.dias_semana || '').toLowerCase().includes(d.value);
                  return (
                    <button
                      type="button"
                      key={d.value}
                      onClick={() => setNewDoctor({ ...newDoctor, dias_semana: toggleDaySelection(newDoctor.dias_semana, d.value) })}
                      style={{ flex: 1, padding: '5px 0', borderRadius: '4px', border: isChecked ? '1px solid #3b82f6' : '1px solid #27272a', backgroundColor: isChecked ? '#1d4ed8' : '#09090b', color: isChecked ? '#ffffff' : '#71717a', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="text"
                placeholder="Telefone / WhatsApp"
                value={newDoctor.telefone}
                onChange={(e) => setNewDoctor({ ...newDoctor, telefone: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
              <input
                type="text"
                placeholder="Cidade"
                value={newDoctor.cidade}
                onChange={(e) => setNewDoctor({ ...newDoctor, cidade: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="text"
                placeholder="Bairro"
                value={newDoctor.bairro}
                onChange={(e) => setNewDoctor({ ...newDoctor, bairro: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
              <input
                type="text"
                placeholder="Clínica / Consultório"
                value={newDoctor.complemento}
                onChange={(e) => setNewDoctor({ ...newDoctor, complemento: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <input
                type="text"
                placeholder="Logradouro / Endereço"
                value={newDoctor.endereco}
                onChange={(e) => setNewDoctor({ ...newDoctor, endereco: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
              <input
                type="text"
                placeholder="Número"
                value={newDoctor.numero}
                onChange={(e) => setNewDoctor({ ...newDoctor, numero: e.target.value })}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Link do Maps ou clique ao lado"
                value={newDoctor.map_link}
                onChange={(e) => setNewDoctor({ ...newDoctor, map_link: e.target.value })}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
              />
              <button
                type="button"
                onClick={() => getCurrentLocation((url) => setNewDoctor((prev) => ({ ...prev, map_link: url })))}
                style={{ backgroundColor: '#15803d', color: '#fff', border: 'none', padding: '0 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                {gettingLocation ? '...' : 'GPS Atual'}
              </button>
            </div>

            <input
              type="text"
              placeholder="Observações"
              value={newDoctor.observacoes}
              onChange={(e) => setNewDoctor({ ...newDoctor, observacoes: e.target.value })}
              style={{ padding: '8px', borderRadius: '6px', border: '1px solid #27272a', backgroundColor: '#09090b', color: '#fff', fontSize: '12px' }}
            />

            <button
              type="submit"
              style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}
            >
              Salvar Cadastro
            </button>
          </form>
        )}

        {/* Tabs de Dias da Semana */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#121215', padding: '3px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #1f1f23' }}>
          {TABS_NAVEGACAO.map((tab) => {
            const isNovos = tab.value === 'novos';
            const isSelected = selectedTab === tab.value;

            return (
              <button
                key={tab.value}
                onClick={() => setSelectedTab(tab.value)}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected ? (isNovos ? '#15803d' : '#2563eb') : 'transparent',
                  color: isSelected ? '#ffffff' : (isNovos ? '#4ade80' : '#71717a'),
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filtros em Linha */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #1f1f23', backgroundColor: '#121215', color: '#d4d4d8', fontSize: '12px', outline: 'none' }}
          >
            <option value="ALL">Todas as Cidades</option>
            {cities.map((city) => (
              <option key={city} value={city}>{city.toUpperCase()}</option>
            ))}
          </select>

          <select
            value={selectedShiftFilter}
            onChange={(e) => setSelectedShiftFilter(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #1f1f23', backgroundColor: '#121215', color: '#d4d4d8', fontSize: '12px', outline: 'none' }}
          >
            <option value="ALL">Todos os Turnos</option>
            <option value="Manhã">Apenas Manhã</option>
            <option value="Tarde">Apenas Tarde</option>
            <option value="Manhã e Tarde">Integral</option>
          </select>
        </div>

        {/* Busca */}
        <div style={{ marginBottom: '14px' }}>
          <input
            type="text"
            placeholder="Buscar por médico, clínica, bairro ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #1f1f23', backgroundColor: '#121215', color: '#f4f4f5', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Lista de Médicos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#71717a', fontSize: '12px' }}>Carregando roteiro...</div>
        ) : filteredDoctors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#71717a', backgroundColor: '#121215', borderRadius: '8px', border: '1px solid #1f1f23', fontSize: '12px' }}>
            Nenhum médico encontrado.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredDoctors.map((doc) => {
              const isEditing = editingId === doc.id;
              const currentShift = doc.turno || 'Manhã e Tarde';
              const isRecent = isRecentDoctor(doc.created_at);

              const doctorDaysList = (doc.dias_semana || doc.dia_semana || '')
                .toUpperCase()
                .split(',')
                .map(d => d.trim())
                .filter(Boolean);

              return (
                <div
                  key={doc.id}
                  style={{
                    backgroundColor: '#121215',
                    border: '1px solid #1f1f23',
                    borderLeft: isRecent ? '3px solid #22c55e' : '1px solid #1f1f23',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase' }}>
                          {doc.descricao}
                        </h3>
                        {isRecent && (
                          <span style={{ fontSize: '9px', backgroundColor: '#14532d', color: '#4ade80', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            NOVO
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px' }}>
                        {doc.crm && <span style={{ fontSize: '11px', color: '#71717a' }}>CRM {doc.crm.toUpperCase()}</span>}
                        {doctorDaysList.map((dayTag) => (
                          <span key={dayTag} style={{ fontSize: '9px', color: '#60a5fa', backgroundColor: '#1e3a8a', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            {dayTag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {!isEditing && (
                      <div style={{ display: 'flex', gap: '6px', opacity: 0.7 }}>
                        <button
                          onClick={() => handleStartEdit(doc)}
                          style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '11px', cursor: 'pointer', padding: '2px 4px' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteDoctor(doc)}
                          style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '11px', cursor: 'pointer', padding: '2px 4px' }}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div style={{ backgroundColor: '#09090b', padding: '10px', borderRadius: '6px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: '#71717a', display: 'block', marginBottom: '3px' }}>Dias de Atendimento:</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {OPCOES_DIAS.map((d) => {
                            const isChecked = (editForm.dias_semana || '').toLowerCase().includes(d.value);
                            return (
                              <button
                                type="button"
                                key={d.value}
                                onClick={() => setEditForm({ ...editForm, dias_semana: toggleDaySelection(editForm.dias_semana, d.value) })}
                                style={{ flex: 1, padding: '4px 0', borderRadius: '4px', border: isChecked ? '1px solid #3b82f6' : '1px solid #27272a', backgroundColor: isChecked ? '#1d4ed8' : '#18181b', color: isChecked ? '#ffffff' : '#71717a', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Telefone"
                          value={editForm.telefone || ''}
                          onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }}
                        />
                        <input
                          type="text"
                          placeholder="Clínica / Local"
                          value={editForm.complemento || ''}
                          onChange={(e) => setEditForm({ ...editForm, complemento: e.target.value })}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Endereço"
                          value={editForm.endereco || ''}
                          onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }}
                        />
                        <input
                          type="text"
                          placeholder="Bairro"
                          value={editForm.bairro || ''}
                          onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Link GPS Maps"
                          value={editForm.map_link || ''}
                          onChange={(e) => setEditForm({ ...editForm, map_link: e.target.value })}
                          style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }}
                        />
                        <button
                          type="button"
                          onClick={() => getCurrentLocation((url) => setEditForm((prev) => ({ ...prev, map_link: url })))}
                          style={{ backgroundColor: '#15803d', color: '#fff', border: 'none', padding: '0 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          GPS
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Observações do Propagandista"
                        value={editForm.observacoes || ''}
                        onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }}
                      />

                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={{ padding: '4px 10px', backgroundColor: '#27272a', color: '#ccc', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(doc.id)}
                          style={{ padding: '4px 10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#d4d4d8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>
                        {doc.complemento ? doc.complemento : 'Consultório Próprio'}
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: '12px' }}>
                        {doc.endereco}{doc.numero && `, ${doc.numero}`}
                        {doc.bairro && <span style={{ color: '#d4d4d8', fontWeight: 500 }}> — {doc.bairro.toUpperCase()}</span>}
                        {doc.cidade && <span style={{ color: '#60a5fa', fontWeight: 600 }}> • {doc.cidade.toUpperCase()}</span>}
                      </div>
                    </div>
                  )}

                  {!isEditing && doc.observacoes && (
                    <div style={{ borderLeft: '2px solid #f59e0b', paddingLeft: '8px', fontSize: '11px', color: '#fbbf24', fontStyle: 'italic', marginTop: '2px' }}>
                      <strong style={{ fontStyle: 'normal' }}>OBS:</strong> {doc.observacoes}
                    </div>
                  )}

                  {!isEditing && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #1f1f23', gap: '8px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', backgroundColor: '#09090b', borderRadius: '5px', padding: '2px', border: '1px solid #1f1f23' }}>
                        {OPCOES_TURNO.map((opcao) => {
                          const isSelected = currentShift === opcao;
                          return (
                            <button
                              key={opcao}
                              onClick={() => handleUpdateShift(doc.id, opcao)}
                              style={{
                                padding: '3px 7px',
                                borderRadius: '3px',
                                border: 'none',
                                backgroundColor: isSelected ? '#2563eb' : 'transparent',
                                color: isSelected ? '#ffffff' : '#71717a',
                                fontSize: '10px',
                                fontWeight: isSelected ? 600 : 400,
                                cursor: 'pointer'
                              }}
                            >
                              {opcao === 'Manhã e Tarde' ? 'Integral' : opcao}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => openNavigation(doc)}
                          style={{ padding: '4px 9px', backgroundColor: doc.map_link ? '#15803d' : '#1e3a8a', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {doc.map_link ? 'GPS Fixo' : 'GPS'}
                        </button>

                        {doc.telefone && (
                          <button
                            onClick={() => openWhatsApp(doc.telefone)}
                            style={{ padding: '4px 9px', backgroundColor: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}