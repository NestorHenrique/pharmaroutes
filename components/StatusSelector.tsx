'use client';

import { useState } from 'react';
import StatusSheet from '@/components/StatusSheet';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';

/* ── Botão da bandeira do card: abre a folha "Marcar status" (sobe de baixo) ── */

interface StatusSelectorProps {
  doctorId: string;
  doctorName: string;
  /** "ORT · Centro" */
  doctorSubtitle?: string;
  statuses: DoctorStatus[];
  onSet: (
    doctorId: string,
    type: DoctorStatusType,
    opts?: { repName?: string; returnDate?: string },
  ) => void;
  onClear: (doctorId: string, type: DoctorStatusType) => void;
  /** médico já visitado (ciclo ou dia) */
  visited: boolean;
  /** liga/desliga a visita; sem ela a opção "Já visitei" não aparece */
  onToggleVisited?: (visited: boolean) => void;
}

export default function StatusSelector({
  doctorId,
  doctorName,
  doctorSubtitle,
  statuses,
  onSet,
  onClear,
  visited,
  onToggleVisited,
}: StatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const hasActiveStatus = statuses.length > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Marcar status"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`size-11 shrink-0 rounded-xl border border-blue-800 bg-blue-950 text-blue-600 flex items-center justify-center ${
          hasActiveStatus ? 'ring-1 ring-blue-600' : ''
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 21V4M5 4h11l-2.5 4L16 12H5" />
        </svg>
      </button>

      {open && (
        <StatusSheet
          doctorId={doctorId}
          doctorName={doctorName}
          doctorSubtitle={doctorSubtitle}
          statuses={statuses}
          visited={visited}
          onSet={onSet}
          onClear={onClear}
          onToggleVisited={onToggleVisited}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
