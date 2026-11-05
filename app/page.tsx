'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDoctors } from '@/hooks/useDoctors';

// Importação dos seus componentes
import LoginForm from '@/components/auth/LoginForm';
import InstallBanner from '@/components/layout/InstallBanner';
import AppHeader from '@/components/layout/AppHeader';
import DoctorForm from '@/components/doctors/DoctorForm';
import WeekTabs from '@/components/doctors/WeekTabs';
import DoctorFilters from '@/components/doctors/DoctorFilters';
import DoctorList from '@/components/doctors/DoctorList';

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

  // Se estiver carregando a sessão, não mostra nada (ou pode colocar um LoadingSpinner)
  if (authLoading) return null; 

  // Se não tiver usuário logado, renderiza apenas o componente de Login
  if (!user) return <LoginForm />;

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

        <WeekTabs 
          selectedTab={selectedTab} 
          setSelectedTab={setSelectedTab} 
        />

        <DoctorFilters 
          cities={cities}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          selectedShiftFilter={selectedShiftFilter}
          setSelectedShiftFilter={setSelectedShiftFilter}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />

        <DoctorList 
          doctors={doctors}
          searchTerm={searchTerm}
          selectedShiftFilter={selectedShiftFilter}
          loading={doctorsLoading}
          onUpdateShift={updateShift}
          onUpdateDoctor={updateDoctor}
          onDeleteDoctor={deleteDoctor}
        />

      </main>
    </div>
  );
}