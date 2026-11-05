import { useState } from 'react';
import { Doctor } from '@/types/doctor';
import { OPCOES_DIAS } from '@/constants';

interface DoctorFormProps {
  onAddDoctor: (doc: Partial<Doctor>) => Promise<boolean>;
  onClose: () => void;
  defaultTab: string;
  defaultCity: string;
}

const toggleDaySelection = (currentDaysString: string = '', dayValue: string) => {
  const daysArray = currentDaysString.toLowerCase().split(',').map(d => d.trim()).filter(Boolean);
  const updatedArray = daysArray.includes(dayValue)
    ? daysArray.filter(d => d !== dayValue)
    : [...daysArray, dayValue];
  return updatedArray.join(', ');
};

export default function DoctorForm({ onAddDoctor, onClose, defaultTab, defaultCity }: DoctorFormProps) {
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    descricao: '', crm: '', dias_semana: defaultTab, cidade: defaultCity, bairro: '', endereco: '', numero: '', complemento: '', turno: 'Manhã e Tarde', observacoes: '', telefone: '', email: '', map_link: '',
  });
  const [gettingLocation, setGettingLocation] = useState(false);

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

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctor.descricao) return;
    const success = await onAddDoctor(newDoctor);
    if (success) onClose();
  };

  return (
    <form onSubmit={handleCreateDoctor} style={{ backgroundColor: 'rgba(24, 24, 27, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '18px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
      <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#fff', fontWeight: 600 }}>Novo Cadastro</h3>
      <input type="text" required placeholder="Nome do Médico *" value={newDoctor.descricao} onChange={e => setNewDoctor({...newDoctor, descricao: e.target.value})} style={{ padding: '10px 14px', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '13px' }} />
      
      <div style={{ display: 'flex', gap: '6px' }}>
        {OPCOES_DIAS.map(d => {
          const isChecked = (newDoctor.dias_semana || '').toLowerCase().includes(d.value);
          return <button type="button" key={d.value} onClick={() => setNewDoctor({ ...newDoctor, dias_semana: toggleDaySelection(newDoctor.dias_semana, d.value) })} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: isChecked ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.05)', backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)', color: isChecked ? '#60a5fa' : '#a1a1aa', fontSize: '11px', fontWeight: 600, transition: 'all 0.2s' }}>{d.label}</button>
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <input type="text" placeholder="CRM" value={newDoctor.crm} onChange={e => setNewDoctor({...newDoctor, crm: e.target.value})} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '12px' }} />
        <input type="text" placeholder="Telefone" value={newDoctor.telefone} onChange={e => setNewDoctor({...newDoctor, telefone: e.target.value})} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '12px' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <input type="text" placeholder="Bairro" value={newDoctor.bairro} onChange={e => setNewDoctor({...newDoctor, bairro: e.target.value})} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '12px' }} />
        <input type="text" placeholder="Clínica" value={newDoctor.complemento} onChange={e => setNewDoctor({...newDoctor, complemento: e.target.value})} style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '12px' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input type="text" placeholder="Link do Maps" value={newDoctor.map_link} onChange={e => setNewDoctor({...newDoctor, map_link: e.target.value})} style={{ flex: 1, padding: '10px', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', fontSize: '12px' }} />
        <button type="button" onClick={() => getCurrentLocation(url => setNewDoctor(p => ({...p, map_link: url})))} style={{ padding: '0 12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>{gettingLocation ? '...' : 'Pegar GPS'}</button>
      </div>

      <button type="submit" style={{ padding: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, marginTop: '4px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>Salvar Cadastro</button>
    </form>
  );
}