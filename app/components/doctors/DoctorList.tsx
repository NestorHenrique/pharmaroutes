'use client';

import React from 'react';

export default function DoctorList({ doctors = [] }: { doctors: any[] }) {
  return (
    <div className="w-full space-y-3">
      {doctors.map((doctor, index) => {
        // Verifica se o médico é recente (criado há menos de 2 dias)
        const isRecent = doctor.created_at 
          ? (Math.abs(new Date().getTime() - new Date(doctor.created_at).getTime()) / (1000 * 60 * 60 * 24)) <= 2
          : false;

        return (
          <div 
            key={doctor.id || index}
            className="group relative bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950/90 backdrop-blur-xl border border-slate-800/80 hover:border-blue-500/50 p-5 rounded-2xl shadow-xl transition-all duration-300 hover:shadow-blue-500/10"
          >
            {/* Brilho superior subtil ao passar o rato / tocar */}
            <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3.5">
                
                {/* Ícone Minimalista Moderno (Substitui emojis antigos) */}
                <div className="h-10 w-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-white font-semibold text-base tracking-tight">{doctor.nome}</h3>
                  <p className="text-xs text-slate-400">{doctor.especialidade || 'Especialidade não informada'}</p>
                </div>
              </div>

              {/* Tag de Status "Novo" com Design de Brilho */}
              {isRecent && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                  Novo
                </span>
              )}
            </div>

            {/* Informações Secundárias */}
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-1.5">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{doctor.endereco || 'Local não definido'}</span>
              </div>

              <div className="font-medium text-slate-300">
                {doctor.turno || 'Matutino'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}