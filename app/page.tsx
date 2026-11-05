'use client';

import { useState } from 'react';
import { TABS_NAVEGACAO } from '@/constants';
import { useAuth } from '@/app/hooks/useAuth';
import { useDoctors } from '@/app/hooks/useDoctors';
import { toggleDaySelection } from '@/utils/doctor';

import LoginForm from '@/app/components/auth/LoginForm';
import InstallBanner from '@/app/components/layout/InstallBanner';
import AppHeader from '@/app/components/layout/AppHeader';
import DoctorForm from '@/app/components/doctors/Doctorform';
import DoctorFilters from '@/app/components/doctors/DoctorFilters';
import DoctorList from '@/app/components/doctors/DoctorList';

export default function Home() {
  // O hook useAuth agora cuida de toda a lógica do Supabase (login, sessão, loading)
  const { user, authLoading } = useAuth();

  // Estados que controlam a interface e os filtros na tela principal
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTab, setSelectedTab] = useState('seg');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // O hook useDoctors traz os dados e as funções de manipular o banco
  const { 
    doctors, 
    cities, 
    loading: doctorsLoading, 
    addDoctor, 
    updateDoctor, 
    updateShift, 
    deleteDoctor 
  } = useDoctors(user, selectedTab, selectedCity);

  if (authLoading) return null;

  if (!user) return <LoginForm />;

  const filteredDoctors = doctors.filter((doctor) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      doctor.descricao?.toLowerCase().includes(term) ||
      doctor.bairro?.toLowerCase().includes(term) ||
      doctor.complemento?.toLowerCase().includes(term) ||
      doctor.observacoes?.toLowerCase().includes(term) ||
      doctor.telefone?.toLowerCase().includes(term);
    const doctorShift = doctor.turno || 'Manhã e Tarde';
    const matchesShift =
      selectedShiftFilter === 'ALL' ||
      doctorShift === selectedShiftFilter ||
      doctorShift === 'Manhã e Tarde';

    return matchesSearch && matchesShift;
  });

  return (
    <div style={{ background: 'radial-gradient(circle at top left, #1e1b4b 0%, #09090b 40%)', minHeight: '100vh', color: '#f4f4f5', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      <InstallBanner />

      <AppHeader 
        userEmail={user.email} 
        showAddForm={showAddForm} 
        setShowAddForm={setShowAddForm} 
      />

      <main style={{ padding: '20px 14px', maxWidth: '640px', margin: '0 auto' }}>
        
        {showAddForm && (
          <DoctorForm 
            onAddDoctor={addDoctor} 
            onClose={() => setShowAddForm(false)} 
            defaultTab={selectedTab !== 'novos' ? selectedTab : 'seg'}
            defaultCity={selectedCity !== 'ALL' ? selectedCity : 'PARNAIBA'}
          />
        )}

        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(24, 24, 27, 0.6)', padding: '4px', borderRadius: '10px', marginBottom: '14px' }}>
          {TABS_NAVEGACAO.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedTab(tab.value)}
              style={{ flex: 1, padding: '8px 0', borderRadius: '7px', border: 'none', backgroundColor: selectedTab === tab.value ? '#2563eb' : 'transparent', color: selectedTab === tab.value ? '#fff' : '#a1a1aa', cursor: 'pointer' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DoctorFilters 
          cities={cities}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          selectedShiftFilter={selectedShiftFilter}
          setSelectedShiftFilter={setSelectedShiftFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />

        {doctorsLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#a1a1aa' }}>Carregando roteiro...</div>
        ) : filteredDoctors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#a1a1aa' }}>Nenhum médico encontrado.</div>
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