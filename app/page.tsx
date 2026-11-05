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

  if (authLoading) return null; 
  if (!user) return <LoginForm />;

  return (
    <div style={{ backgroundColor: '#000000', minHeight: '100vh', color: '#FAFAFA', fontFamily: 'Inter, -apple-system, sans-serif', paddingBottom: '80px' }}>
      
      <InstallBanner />
      <AppHeader userEmail={user.email} />

      <main style={{ padding: '16px', maxWidth: '640px', margin: '0 auto' }}>
        
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

      {/* Botão Flutuante (FAB) - Ergonomia Mobile */}
      <button 
        onClick={() => setShowAddForm(!showAddForm)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 50,
          width: '60px', height: '60px', borderRadius: '30px',
          background: showAddForm ? '#27272A' : '#4F46E5', // Indigo moderno
          color: '#FFF', fontSize: '28px', fontWeight: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: showAddForm ? 'none' : '0 12px 32px rgba(79, 70, 229, 0.4)',
          cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {showAddForm ? '✕' : '+'}
      </button>
    </div>
  );
}