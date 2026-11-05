import { useState } from 'react';
import { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_TURNO } from '@/constants';
import { isRecentDoctor } from '@/utils';

interface DoctorListProps {
  doctors: Doctor[];
  searchTerm: string;
  selectedShiftFilter: string;
  loading: boolean;
  onUpdateShift: (docId: string, newTurno: string, docName: string) => void;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
}

export default function DoctorList({ doctors, searchTerm, selectedShiftFilter, loading, onUpdateShift, onUpdateDoctor, onDeleteDoctor }: DoctorListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  if (loading) return <div style={{ textAlign: 'center', padding: '40px', color: '#71717A', fontSize: '14px', fontWeight: 500 }}>Buscando médicos...</div>;
  if (doctors.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: '#71717A', backgroundColor: '#0A0A0B', borderRadius: '24px', border: '1px dashed #27272A', fontSize: '14px' }}>Nenhum médico encontrado.</div>;

  const openNav = (doc: Doctor) => window.open(doc.map_link?.trim() || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${doc.endereco}, ${doc.numero || 'SN'}, ${doc.bairro || ''}, ${doc.cidade || ''}`)}`, '_blank');
  const openWpp = (phone?: string) => phone && window.open(`https://wa.me/${phone.replace(/\D/g, '').startsWith('55') ? phone.replace(/\D/g, '') : `55${phone.replace(/\D/g, '')}`}`, '_blank');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {doctors.map((doc) => {
        const isRecent = isRecentDoctor(doc.created_at);
        const days = (doc.dias_semana || doc.dia_semana || '').toUpperCase().split(',').map(d => d.trim()).filter(Boolean);
        const shift = doc.turno || 'Manhã e Tarde';

        return (
          <div key={doc.id} style={{ backgroundColor: '#0A0A0B', border: '1px solid #1A1A1A', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#FAFAFA', letterSpacing: '-0.3px', textTransform: 'capitalize' }}>{doc.descricao?.toLowerCase()}</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {isRecent && <span style={{ fontSize: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '4px 8px', borderRadius: '100px', fontWeight: 700 }}>NOVO</span>}
                  {doc.crm && <span style={{ fontSize: '11px', color: '#A1A1AA', fontWeight: 500 }}>CRM {doc.crm}</span>}
                </div>
              </div>
              <button onClick={() => { if(window.confirm(`Excluir ${doc.descricao}?`)) onDeleteDoctor(doc); }} style={{ background: 'none', border: 'none', color: '#52525B', fontSize: '18px', cursor: 'pointer', padding: '4px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ color: '#E4E4E7', fontWeight: 500, fontSize: '14px' }}>{doc.complemento || 'Consultório Próprio'}</div>
              <div style={{ color: '#71717A', fontSize: '13px', lineHeight: '1.5' }}>
                {doc.endereco}{doc.numero && `, ${doc.numero}`} <br/>
                {doc.bairro && <span>{doc.bairro} — </span>} <span style={{ color: '#A1A1AA' }}>{doc.cidade}</span>
              </div>
            </div>

            {doc.observacoes && (
              <div style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '12px', fontSize: '13px', color: '#D4D4D8', borderLeft: '3px solid #4F46E5' }}>
                {doc.observacoes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #1A1A1A', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', backgroundColor: '#141414', borderRadius: '100px', padding: '4px', border: '1px solid #27272A' }}>
                {OPCOES_TURNO.map((opcao) => {
                  const isSelected = shift === opcao;
                  return (
                    <button key={opcao} onClick={() => onUpdateShift(doc.id, opcao, doc.descricao || '')} style={{ padding: '6px 12px', borderRadius: '100px', border: 'none', backgroundColor: isSelected ? '#27272A' : 'transparent', color: isSelected ? '#FAFAFA' : '#71717A', fontSize: '11px', fontWeight: isSelected ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s' }}>
                      {opcao === 'Manhã e Tarde' ? 'Integral' : opcao}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openNav(doc)} style={{ padding: '10px 16px', background: '#FAFAFA', color: '#000', border: 'none', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  GPS
                </button>
                {doc.telefone && (
                  <button onClick={() => openWpp(doc.telefone)} style={{ padding: '10px 16px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '100px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    WhatsApp
                  </button>
                )}
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}