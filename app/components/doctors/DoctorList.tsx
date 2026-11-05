import { useState } from 'react';
import { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_TURNO } from '@/constants';
import { isRecentDoctor } from '@/utils';

interface DoctorListProps {
  doctors: Doctor[];
  onUpdateShift: (docId: string, newTurno: string, docName: string) => void;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
  toggleDaySelection: (current: string | undefined, day: string) => string;
}

export default function DoctorList({ doctors, onUpdateShift, onUpdateDoctor, onDeleteDoctor, toggleDaySelection }: DoctorListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Doctor>>({});
  const [gettingLocation, setGettingLocation] = useState<boolean>(false);

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
      },
      () => {
        alert('Erro ao capturar GPS.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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

  const handleSaveEdit = async (docId: string, docName: string) => {
    const success = await onUpdateDoctor(docId, editForm, docName);
    if (success) setEditingId(null);
  };

  const handleDelete = (doc: Doctor) => {
    if (window.confirm(`Deseja remover "${doc.descricao}"?`)) {
      onDeleteDoctor(doc);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {doctors.map((doc) => {
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
              backgroundColor: 'rgba(24, 24, 27, 0.4)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderLeft: isRecent ? '3px solid #34d399' : '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
                    {doc.descricao}
                  </h3>
                  {isRecent && (
                    <span style={{ fontSize: '9px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 6px', borderRadius: '12px', fontWeight: 700 }}>
                      NOVO
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                  {doc.crm && <span style={{ fontSize: '10px', color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '6px' }}>CRM {doc.crm.toUpperCase()}</span>}
                  {doctorDaysList.map((dayTag) => (
                    <span key={dayTag} style={{ fontSize: '10px', color: '#60a5fa', backgroundColor: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
                      {dayTag}
                    </span>
                  ))}
                </div>
              </div>

              {!isEditing && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleStartEdit(doc)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer', padding: '4px 10px', transition: 'background 0.2s' }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(doc)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', fontSize: '11px', cursor: 'pointer', padding: '4px 10px' }}>
                    Excluir
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Dias de Atendimento:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {OPCOES_DIAS.map((d) => {
                      const isChecked = (editForm.dias_semana || '').toLowerCase().includes(d.value);
                      return (
                        <button
                          type="button"
                          key={d.value}
                          onClick={() => setEditForm({ ...editForm, dias_semana: toggleDaySelection(editForm.dias_semana, d.value) })}
                          style={{ flex: 1, padding: '6px 0', borderRadius: '6px', border: isChecked ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.05)', backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.3)', color: isChecked ? '#60a5fa' : '#94a3b8', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="text" placeholder="Telefone" value={editForm.telefone || ''} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', outline: 'none' }} />
                  <input type="text" placeholder="Clínica / Local" value={editForm.complemento || ''} onChange={(e) => setEditForm({ ...editForm, complemento: e.target.value })} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', outline: 'none' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                  <input type="text" placeholder="Endereço" value={editForm.endereco || ''} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', outline: 'none' }} />
                  <input type="text" placeholder="Bairro" value={editForm.bairro || ''} onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', outline: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="Link GPS Maps" value={editForm.map_link || ''} onChange={(e) => setEditForm({ ...editForm, map_link: e.target.value })} style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', outline: 'none' }} />
                  <button type="button" onClick={() => getCurrentLocation((url) => setEditForm((prev) => ({ ...prev, map_link: url })))} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    {gettingLocation ? '...' : 'GPS'}
                  </button>
                </div>

                <input type="text" placeholder="Observações do Propagandista" value={editForm.observacoes || ''} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '12px', outline: 'none' }} />

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" onClick={() => setEditingId(null)} style={{ padding: '8px 16px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button type="button" onClick={() => handleSaveEdit(doc.id, doc.descricao || '')} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>Salvar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ color: '#38bdf8', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
                  {doc.complemento ? doc.complemento : 'Consultório Próprio'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: '1.4' }}>
                  {doc.endereco}{doc.numero && `, ${doc.numero}`}
                  {doc.bairro && <span style={{ color: '#cbd5e1', fontWeight: 500 }}> — {doc.bairro.toUpperCase()}</span>}
                  {doc.cidade && <span style={{ color: '#60a5fa', fontWeight: 600 }}> {doc.cidade.toUpperCase()}</span>}
                </div>
              </div>
            )}

            {!isEditing && doc.observacoes && (
              <div style={{ borderLeft: '2px solid rgba(245, 158, 11, 0.6)', paddingLeft: '10px', fontSize: '12px', color: '#fbbf24', fontStyle: 'italic', backgroundColor: 'rgba(245, 158, 11, 0.05)', padding: '8px 10px', borderRadius: '0 8px 8px 0' }}>
                <strong style={{ fontStyle: 'normal', color: '#f59e0b' }}>OBS:</strong> {doc.observacoes}
              </div>
            )}

            {!isEditing && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', gap: '8px' }}>
                <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {OPCOES_TURNO.map((opcao) => {
                    const isSelected = currentShift === opcao;
                    return (
                      <button
                        key={opcao}
                        onClick={() => onUpdateShift(doc.id, opcao, doc.descricao || '')}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent', color: isSelected ? '#fff' : '#64748b', fontSize: '10px', fontWeight: isSelected ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        {opcao === 'Manhã e Tarde' ? 'Integral' : opcao}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => openNavigation(doc)} style={{ padding: '6px 14px', background: doc.map_link ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'rgba(255,255,255,0.08)', color: doc.map_link ? '#fff' : '#cbd5e1', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', boxShadow: doc.map_link ? '0 4px 12px rgba(5, 150, 105, 0.2)' : 'none' }}>
                    {doc.map_link ? '📍 GPS Fixo' : '📍 GPS'}
                  </button>
                  {doc.telefone && (
                    <button onClick={() => openWhatsApp(doc.telefone)} style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                      💬 WhatsApp
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}