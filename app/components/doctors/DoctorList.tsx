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
        alert('Localização obtida via GPS!');
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
    if (window.confirm(`Deseja remover "${doc.descricao}"? Esta ação ficará gravada no seu utilizador.`)) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  <button onClick={() => handleStartEdit(doc)} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '11px', cursor: 'pointer', padding: '2px 4px' }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(doc)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '11px', cursor: 'pointer', padding: '2px 4px' }}>
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
                  <input type="text" placeholder="Telefone" value={editForm.telefone || ''} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }} />
                  <input type="text" placeholder="Clínica / Local" value={editForm.complemento || ''} onChange={(e) => setEditForm({ ...editForm, complemento: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                  <input type="text" placeholder="Endereço" value={editForm.endereco || ''} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }} />
                  <input type="text" placeholder="Bairro" value={editForm.bairro || ''} onChange={(e) => setEditForm({ ...editForm, bairro: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }} />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" placeholder="Link GPS Maps" value={editForm.map_link || ''} onChange={(e) => setEditForm({ ...editForm, map_link: e.target.value })} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }} />
                  <button type="button" onClick={() => getCurrentLocation((url) => setEditForm((prev) => ({ ...prev, map_link: url })))} style={{ backgroundColor: '#15803d', color: '#fff', border: 'none', padding: '0 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                    {gettingLocation ? '...' : 'GPS'}
                  </button>
                </div>

                <input type="text" placeholder="Observações do Propagandista" value={editForm.observacoes || ''} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#fff', fontSize: '11px' }} />

                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button type="button" onClick={() => setEditingId(null)} style={{ padding: '4px 10px', backgroundColor: '#27272a', color: '#ccc', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                  <button type="button" onClick={() => handleSaveEdit(doc.id, doc.descricao || '')} style={{ padding: '4px 10px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
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
                  {doc.cidade && <span style={{ color: '#60a5fa', fontWeight: 600 }}> {doc.cidade.toUpperCase()}</span>}
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
                        onClick={() => onUpdateShift(doc.id, opcao, doc.descricao || '')}
                        style={{ padding: '3px 7px', borderRadius: '3px', border: 'none', backgroundColor: isSelected ? '#2563eb' : 'transparent', color: isSelected ? '#ffffff' : '#71717a', fontSize: '10px', fontWeight: isSelected ? 600 : 400, cursor: 'pointer' }}
                      >
                        {opcao === 'Manhã e Tarde' ? 'Integral' : opcao}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => openNavigation(doc)} style={{ padding: '4px 9px', backgroundColor: doc.map_link ? '#15803d' : '#1e3a8a', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    {doc.map_link ? 'GPS Fixo' : 'GPS'}
                  </button>
                  {doc.telefone && (
                    <button onClick={() => openWhatsApp(doc.telefone)} style={{ padding: '4px 9px', backgroundColor: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
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
  );
}