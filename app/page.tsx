'use client';

import { useState } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { useDoctors } from '@/app/hooks/useDoctors';

import LoginForm from '@/app/components/auth/LoginForm';
import InstallBanner from '@/app/components/layout/InstallBanner';
import AppHeader from '@/app/components/layout/AppHeader';
import DoctorForm from '@/app/components/doctors/Doctorform';
import WeekTabs from '@/app/components/doctors/WeekTabs';
import DoctorFilters from '@/app/components/doctors/DoctorFilters';
import DoctorList from '@/app/components/doctors/DoctorList';

export default function Home() {
  const { user, authLoading } = useAuth();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTab, setSelectedTab] = useState('seg');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const { doctors, cities, loading: doctorsLoading, addDoctor, updateDoctor, updateShift, deleteDoctor } = useDoctors(user, selectedTab, selectedCity);

  if (authLoading) {
    return (
      <div className="auth-loading" role="status">
        Carregando PharmaRoutes...
      </div>
    );
  }
  if (!user) return <LoginForm />;

  return (
    <div className="app-shell">
      
      <InstallBanner />
      <AppHeader userEmail={user.email} />

      <main className="app-main">
        
        {showAddForm && (
          <DoctorForm 
            onAddDoctor={addDoctor} 
            onClose={() => setShowAddForm(false)} 
            defaultTab={selectedTab !== 'novos' ? selectedTab : 'seg'}
            defaultCity={selectedCity !== 'ALL' ? selectedCity : 'PARNAIBA'}
          />
        )}

        <WeekTabs selectedTab={selectedTab} setSelectedTab={setSelectedTab} />

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

      <button 
        onClick={() => setShowAddForm(!showAddForm)}
        className="add-doctor-fab"
        aria-label={showAddForm ? 'Fechar cadastro de médico' : 'Adicionar médico'}
      >
        {showAddForm ? '✕' : '+'}
      </button>
    </div>
  );
}