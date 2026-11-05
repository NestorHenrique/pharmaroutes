import { Doctor } from '@/types/doctor';
import DoctorCard from './DoctorCard';

interface DoctorListProps {
  doctors: Doctor[];
  searchTerm: string;
  selectedShiftFilter: string;
  loading: boolean;
  onUpdateShift: (docId: string, newTurno: string, docName: string) => void;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
}

export default function DoctorList({ doctors, loading, onUpdateShift, onUpdateDoctor, onDeleteDoctor }: DoctorListProps) {
  if (loading) return <div style={{ textAlign: 'center', padding: '40px', color: '#3b82f6', fontSize: '14px', fontWeight: 600 }}>Carregando roteiro...</div>;
  if (doctors.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: '#71717a', backgroundColor: '#09090b', borderRadius: '20px', border: '1px solid #27272a', fontSize: '14px' }}>Nenhum médico encontrado.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {doctors.map((doc) => (
        <DoctorCard 
          key={doc.id}
          doc={doc}
          onUpdateShift={onUpdateShift}
          onUpdateDoctor={onUpdateDoctor}
          onDeleteDoctor={onDeleteDoctor}
        />
      ))}
    </div>
  );
}