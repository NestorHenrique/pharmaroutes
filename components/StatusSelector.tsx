'use client';

import { useState, useRef, useEffect } from 'react';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import {
  STATUS_META,
  QUICK_STATUSES,
  INPUT_STATUSES,
  PROLONGED_STATUSES,
} from '@/types/status';
import { formatTime, minutesRemaining } from '@/utils';

/* ── Types ── */

interface StatusSelectorProps {
  doctorId: string;
  statuses: DoctorStatus[];
  onSet: (
    doctorId: string,
    type: DoctorStatusType,
    opts?: { repName?: string; returnDate?: string },
  ) => void;
  onClear: (doctorId: string, type: DoctorStatusType) => void;
}

type Step = 'closed' | 'menu' | 'input_rep' | 'input_date';

/* ── Component ── */

export default function StatusSelector({ doctorId, statuses, onSet, onClear }: StatusSelectorProps) {
  const [step, setStep] = useState<Step>('closed');
  const [pendingType, setPendingType] = useState<DoctorStatusType | null>(null);
  const [repName, setRepName] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (step === 'closed') return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setStep('closed');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [step]);

  const activeMap = new Map(statuses.map((s) => [s.status_type, s]));
  const hasActiveStatus = statuses.length > 0;

  const handleSelect = (type: DoctorStatusType) => {
    const meta = STATUS_META[type];

    // Se já está ativo, limpa
    if (activeMap.has(type)) {
      onClear(doctorId, type);
      setStep('closed');
      return;
    }

    // Status que precisa de nome do rep
    if (meta.needsRepName) {
      setPendingType(type);
      setRepName('');
      setStep('input_rep');
      return;
    }

    // Status que precisa de data de retorno
    if (meta.needsReturnDate) {
      setPendingType(type);
      setReturnDate('');
      setStep('input_date');
      return;
    }

    // Status rápido
    onSet(doctorId, type);
    setStep('closed');
  };

  const confirmRep = () => {
    if (!pendingType || !repName.trim()) return;
    onSet(doctorId, pendingType, { repName: repName.trim() });
    setStep('closed');
  };

  const confirmDate = () => {
    if (!pendingType || !returnDate) return;
    onSet(doctorId, pendingType, { returnDate });
    setStep('closed');
  };

  /* ── Render ── */

  return (
    <div ref={ref} className="relative">
      {/* Botão toggle */}
      <button
        type="button"
        onClick={() => setStep(step === 'closed' ? 'menu' : 'closed')}
        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
          hasActiveStatus
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
            : 'border-slate-700 bg-slate-800 text-slate-500 hover:text-slate-300'
        }`}
      >
        Status {step !== 'closed' ? '▲' : '▼'}
      </button>

      {/* Dropdown */}
      {step !== 'closed' && (
        <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl shadow-black/40 overflow-hidden">
          {step === 'menu' && (
            <>
              {/* Ativos */}
              {statuses.length > 0 && (
                <div className="border-b border-slate-800 px-2 py-1.5">
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Ativos</span>
                  {statuses.map((s) => {
                    const meta = STATUS_META[s.status_type];
                    const remaining = minutesRemaining(s.expires_at);
                    return (
                      <div
                        key={s.status_type}
                        className={`flex items-center justify-between gap-1 mt-1 rounded px-1.5 py-1 ${meta.bg}`}
                      >
                        <span className={`text-[11px] ${meta.text}`}>
                          {meta.emoji} {meta.label}
                          {s.status_type === 'representante_no_consultorio' && (
                            <span className="text-slate-300"> ({formatTime(s.created_at)})</span>
                          )}
                          {remaining !== null && remaining > 0 && (
                            <span className="text-slate-500"> ({remaining}min)</span>
                          )}
                          {s.return_date && (
                            <span className="text-slate-400">
                              {' '}
                              — Retorno: {new Date(s.return_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleSelect(s.status_type)}
                          className="text-slate-500 hover:text-red-400 text-[11px] px-1"
                          title="Remover status"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rápidos */}
              <div className="px-1 py-1">
                {QUICK_STATUSES.map((type) => {
                  const meta = STATUS_META[type];
                  const isActive = activeMap.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelect(type)}
                      className={`w-full text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-800 flex items-center gap-1.5 ${
                        isActive ? meta.text + ' font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <span>{meta.emoji}</span>
                      {meta.label}
                      {meta.duration ? (
                        <span className="text-slate-600 ml-auto">({meta.duration}min)</span>
                      ) : meta.untilMidnight ? (
                        <span className="text-slate-600 ml-auto">(até 00h)</span>
                      ) : null}
                    </button>
                  );
                })}

                {INPUT_STATUSES.map((type) => {
                  const meta = STATUS_META[type];
                  const isActive = activeMap.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelect(type)}
                      className={`w-full text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-800 flex items-center gap-1.5 ${
                        isActive ? meta.text + ' font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <span>{meta.emoji}</span>
                      {meta.label}
                      {meta.duration ? (
                        <span className="text-slate-600 ml-auto">({meta.duration}min)</span>
                      ) : meta.untilMidnight ? (
                        <span className="text-slate-600 ml-auto">(até 00h)</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Separador */}
              <div className="border-t border-slate-800" />

              {/* Prolongados */}
              <div className="px-1 py-1">
                {PROLONGED_STATUSES.map((type) => {
                  const meta = STATUS_META[type];
                  const isActive = activeMap.has(type);
                  return (
                    <button
                      key={type}
                      onClick={() => handleSelect(type)}
                      className={`w-full text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-800 flex items-center gap-1.5 ${
                        isActive ? meta.text + ' font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <span>{meta.emoji}</span>
                      {meta.label}
                      {meta.needsReturnDate && (
                        <span className="text-slate-600 ml-auto text-[10px]">requer data</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Input: nome do representante */}
          {step === 'input_rep' && (
            <div className="p-2.5 flex flex-col gap-2">
              <span className="text-[11px] text-slate-400">Nome do Representante:</span>
              <input
                autoFocus
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                placeholder="Seu nome"
                className="w-full p-1.5 rounded border border-slate-700 bg-slate-950 text-slate-100 text-xs outline-hidden"
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setStep('menu')}
                  className="px-2 py-1 bg-slate-700 text-slate-300 border-none rounded text-[11px]"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmRep}
                  disabled={!repName.trim()}
                  className="px-2 py-1 bg-blue-600 text-white border-none rounded text-[11px] font-semibold disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {/* Input: data de retorno */}
          {step === 'input_date' && (
            <div className="p-2.5 flex flex-col gap-2">
              <span className="text-[11px] text-slate-400">
                {pendingType && STATUS_META[pendingType].emoji}{' '}
                {pendingType && STATUS_META[pendingType].label} — Data de Retorno:
              </span>
              <input
                autoFocus
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-1.5 rounded border border-slate-700 bg-slate-950 text-slate-100 text-xs outline-hidden"
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => setStep('menu')}
                  className="px-2 py-1 bg-slate-700 text-slate-300 border-none rounded text-[11px]"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmDate}
                  disabled={!returnDate}
                  className="px-2 py-1 bg-blue-600 text-white border-none rounded text-[11px] font-semibold disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
