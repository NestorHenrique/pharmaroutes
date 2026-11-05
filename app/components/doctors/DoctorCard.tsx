import { useState } from 'react';
import { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_TURNO } from '@/constants';
import { isRecentDoctor } from '@/utils';

interface DoctorCardProps {
  doc: Doctor;
  onUpdateShift: (docId: string, newTurno: string, docName: string) => void;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
}

const toggleDaySelection = (currentDaysString: string = '', dayValue: string) => {
  const daysArray = currentDaysString.toLowerCase().split(',').map(d => d.trim()).filter(Boolean);
  const updatedArray = daysArray.includes(dayValue)
    ? daysArray.filter(d => d !== dayValue)
    : [...daysArray, dayValue];
  return updatedArray.join(', ');
};

export default function DoctorCard({ doc, onUpdateShift, onUpdateDoctor, onDeleteDoctor }: DoctorCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Doctor>>({});
  const [gettingLocation, setGettingLocation] = useState(false);

  const currentShift = doc.turno || 'Manhã e Tarde';
  const isRecent = isRecentDoctor(doc.created_at);
  const days = (doc.dias_semana || doc.dia_semana || '').toUpperCase().split(',').map(d => d.trim()).filter(Boolean);

  const getCurrentLocation = (onSuccess: (url: string) => void) => {
    if (!navigator.geolocation) return alert('Geolocalização não suportada.');
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccess(`https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
        setGettingLocation(false);
        alert('GPS capturado!');
      },
      () => {
        alert('Erro ao capturar GPS.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditForm({
      dias_semana: doc.dias_semana || doc.dia_semana || '',
      complemento: doc.complemento || '',
      endereco: doc.endereco || '',
      numero: doc.numero || '',
      bairro: doc.bairro || '',
      observacoes: doc.observacoes || '',
      telefone: doc.telefone || '',
      map_link: doc.map_link || '',
      cidade: doc.cidade || '',
    });
  };

  const handleSave = async () => {
    const success = await onUpdateDoctor(doc.id, editForm, doc.descricao || '');
    if (success) setIsEditing(false);
  };

  const openNavigation = () => {
    if (doc.map_link?.trim()) {
      window.open(doc.map_link, '_blank');
    } else {
      const fullAddress = `${doc.endereco || ''}, ${doc.numero || 'SN'}, ${doc.bairro || ''}, ${doc.cidade || ''}`;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`, '_blank');
    }
  };

  const openWhatsApp = () => {
    if (!doc.telefone) return;
    const cleanPhone = doc.telefone.replace(/\D/g, '');
    const formatted = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  return (
    <div style={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '20px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
      
      {/* Header do Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
            {doc.descricao}
          </h3>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isRecent && <span style={{ fontSize: '10px', backgroundColor: '#065f46', color: '#34d399', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>NOVO</span>}
            {doc.crm && <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>CRM {doc.crm.toUpperCase()}</span>}
            {days.map(d => <span key={d} style={{ fontSize: '10px', backgroundColor: '#1e3a8a', color: '#60a5fa', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>{d}</span>)}
          </div>
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleStartEdit} style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: '11px', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', cursor: 'pointer' }}>Editar</button>
            <button onClick={() => { if(window.confirm(`Excluir ${doc.descricao}?`)) onDeleteDoctor(doc); }} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer' }}>✕</button>
          </div>
        )}
      </div>

      {/* Modo Edição */}
      {isEditing ? (
        <div style={{ backgroundColor: '#121215', padding: '14px', borderRadius: '14px', border: '1px solid #3f3f46', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>DIAS DE ATENDIMENTO:</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {OPCOES_DIAS.map((d) => {
              const isChecked = (editForm.dias_semana || '').toLowerCase().includes(d.value);
              return (
                <button type="button" key={d.value} onClick={() => setEditForm({ ...editForm, dias_semana: toggleDaySelection(editForm.dias_semana, d.value) })} style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: isChecked ? '1px solid #3b82f6' : '1px solid #27272a', backgroundColor: isChecked ? '#2563eb' : '#18181b', color: isChecked ? '#fff' : '#a1a1aa', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {d.label}
                </button>
              );
            })}
          </div>

          <input type="text" placeholder="Nome da Clínica / Consultório" value={editForm.complemento || ''} onChange={e => setEditForm({...editForm, complemento: e.target.value})} style={{ padding: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
            <input type="text" placeholder="Endereço" value={editForm.endereco || ''} onChange={e => setEditForm({...editForm, endereco: e.target.value})} style={{ padding: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
            <input type="text" placeholder="Bairro" value={editForm.bairro || ''} onChange={e => setEditForm({...editForm, bairro: e.target.value})} style={{ padding: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <input type="text" placeholder="Link do Google Maps" value={editForm.map_link || ''} onChange={e => setEditForm({...editForm, map_link: e.target.value})} style={{ flex: 1, padding: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
            <button type="button" onClick={() => getCurrentLocation(url => setEditForm(prev => ({...prev, map_link: url})))} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              {gettingLocation ? '...' : '📍 GPS Atual'}
            </button>
          </div>

          <input type="text" placeholder="Telefone" value={editForm.telefone || ''} onChange={e => setEditForm({...editForm, telefone: e.target.value})} style={{ padding: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />
          <input type="text" placeholder="Observações" value={editForm.observacoes || ''} onChange={e => setEditForm({...editForm, observacoes: e.target.value})} style={{ padding: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }} />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button onClick={() => setIsEditing(false)} style={{ padding: '6px 14px', backgroundColor: '#27272a', color: '#d4d4d8', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSave} style={{ padding: '6px 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Salvar</button>
          </div>
        </div>
      ) : (
        /* Modo Visualização */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '14px', textTransform: 'uppercase' }}>
            🏥 {doc.complemento ? doc.complemento : 'Consultório Próprio'}
          </div>
          <div style={{ color: '#d4d4d8', fontSize: '13px', fontWeight: 500 }}>
            {doc.endereco}{doc.numero && `, ${doc.numero}`}
            {doc.bairro && <span style={{ color: '#a1a1aa' }}> — {doc.bairro.toUpperCase()}</span>}
            {doc.cidade && <span style={{ color: '#60a5fa', fontWeight: 700 }}> ({doc.cidade.toUpperCase()})</span>}
          </div>
        </div>
      )}

      {/* OBS em Destaque */}
      {!isEditing && doc.observacoes && (
        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderLeft: '4px solid #3b82f6', padding: '10px 12px', borderRadius: '0 8px 8px 0', fontSize: '12px', color: '#93c5fd' }}>
          <strong style={{ color: '#60a5fa' }}>OBS:</strong> {doc.observacoes}
        </div>
      )}

      {/* Rodapé do Card */}
      {!isEditing && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #18181b', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', backgroundColor: '#18181b', borderRadius: '100px', padding: '3px', border: '1px solid #27272a' }}>
            {OPCOES_TURNO.map((opcao) => {
              const isSelected = currentShift === opcao;
              return (
                <button key={opcao} onClick={() => onUpdateShift(doc.id, opcao, doc.descricao || '')} style={{ padding: '5px 10px', borderRadius: '100px', border: 'none', backgroundColor: isSelected ? '#2563eb' : 'transparent', color: isSelected ? '#fff' : '#71717a', fontSize: '10px', fontWeight: isSelected ? 700 : 500, cursor: 'pointer' }}>
                  {opcao === 'Manhã e Tarde' ? 'Integral' : opcao}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={openNavigation} style={{ padding: '8px 14px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)' }}>
              📍 GPS
            </button>
            {doc.telefone && (
              <button onClick={openWhatsApp} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '100px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
                💬 WhatsApp
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}