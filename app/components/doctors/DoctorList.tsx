import { Doctor } from '@/types/doctor';
import DoctorCard from './DoctorCard';
import { SearchIcon } from '../ui/Icons';

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
  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">Carregando roteiro...</span>
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            aria-hidden="true"
            className="flex flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/80 p-4 backdrop-blur-xl motion-safe:animate-pulse sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2.5">
                <div className="h-5 w-2/3 rounded-md bg-slate-800" />
                <div className="h-3.5 w-1/3 rounded-md bg-slate-800/70" />
              </div>
              <div className="h-10 w-20 rounded-xl bg-slate-800/70" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-1/2 rounded-md bg-slate-800/70" />
              <div className="h-3.5 w-4/5 rounded-md bg-slate-800/50" />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3.5">
              <div className="h-9 w-40 rounded-full bg-slate-800/70" />
              <div className="h-9 w-24 rounded-full bg-slate-800/70" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-10 text-center backdrop-blur-xl"
      >
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-500"
        >
          <SearchIcon className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-200">Nenhum médico encontrado.</p>
          <p className="mt-1 text-xs text-slate-400">
            Troque o dia ou a cidade, ou cadastre um médico no botão de adicionar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul role="list" className="flex flex-col gap-4">
      {doctors.map((doc) => (
        <li key={doc.id}>
          <DoctorCard
            doc={doc}
            onUpdateShift={onUpdateShift}
            onUpdateDoctor={onUpdateDoctor}
            onDeleteDoctor={onDeleteDoctor}
          />
        </li>
      ))}
    </ul>
  );
}
