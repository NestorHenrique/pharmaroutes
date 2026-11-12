'use client';

import { useEffect, useState, type ReactNode } from 'react';
import CityFilter from '@/components/CityFilter';
import { RepAvatar } from '@/components/RepAvatar';
import type { CityOption } from '@/utils';
import type { ThemePref } from '@/lib/theme';

interface ProfileSheetProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  /** semana de trabalho (null = ainda não escolhida) */
  activeWeek: number | null;
  cityOptions: CityOption[];
  /** cidades da semana (chaves) */
  weekCities: string[];
  /** nomes das cidades para o resumo */
  cityNames: string[];
  onCitiesChange: (keys: string[]) => void;
  cycleVisitedCount: number;
  notifyOn: boolean;
  themePref: ThemePref;
  onChangeWeek: () => void;
  onRenewCycle: () => void;
  /** liga/desliga os avisos; devolve uma mensagem de erro ou null */
  onToggleNotify: (on: boolean) => Promise<string | null>;
  /** exigir aprovação de um colega para mudar nome, CRM, UF e especialidade (vale para todos) */
  approvalOn: boolean;
  onToggleApproval: (on: boolean) => Promise<string | null>;
  onThemeChange: (pref: ThemePref) => void;
  onOpenGuide: () => void;
  onReplayTour: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onClose: () => void;
}

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'onix', label: 'Escuro' },
  { id: 'marfim', label: 'Claro' },
  { id: 'auto', label: 'Automático' },
];

const heading = 'text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400';
const rowCls = 'flex w-full items-center gap-3.5 rounded-2xl border border-slate-800 bg-slate-900 px-4 text-left text-slate-100';

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-slate-500" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

function IconTile({ children, round = false }: { children: ReactNode; round?: boolean }) {
  return (
    <span className={`grid size-[38px] shrink-0 place-items-center text-blue-300 ${round ? 'rounded-full border border-blue-800' : 'rounded-xl bg-blue-950'}`}>
      {children}
    </span>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`flex h-8 w-[52px] shrink-0 items-center rounded-2xl p-[3px] ${on ? 'justify-end bg-blue-600' : 'justify-start bg-slate-700'}`}>
      <span className="size-[26px] rounded-full bg-slate-950" />
    </span>
  );
}

/** Perfil: página com semana, cidades, avisos, aparência, ciclo, ajuda e sair (igual ao desenho) */
export default function ProfileSheet(p: ProfileSheetProps) {
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [p]);

  const toggleNotify = async () => {
    setNotifyBusy(true);
    setNotifyMsg(null);
    const err = await p.onToggleNotify(!p.notifyOn);
    setNotifyBusy(false);
    if (err) setNotifyMsg(err);
  };
  const toggleApproval = async () => {
    setApprovalBusy(true);
    setApprovalMsg(null);
    const err = await p.onToggleApproval(!p.approvalOn);
    setApprovalBusy(false);
    if (err) setApprovalMsg(err);
  };

  const cities = p.cityNames.length > 0 ? p.cityNames.join(', ') : 'Nenhuma escolhida';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 animate-[fade-in_.18s_ease-out]">
      <div role="dialog" aria-modal="true" aria-label="Perfil" className="mx-auto flex h-full w-full max-w-xl flex-col">
        <header className="flex items-center gap-2 px-3 pb-2 pt-4">
          <button type="button" aria-label="Voltar" onClick={p.onClose} className="grid size-11 place-items-center rounded-xl border-0 bg-transparent text-slate-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h1 className="m-0 flex-1 text-xl font-bold tracking-tight text-slate-50">Perfil</h1>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-2">
          <div className="flex items-center gap-3.5">
            <RepAvatar name={p.name || p.email} src={p.avatarUrl} size={72} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-xl font-bold tracking-tight text-slate-50">{p.name || 'Sem nome'}</span>
              <span className="truncate text-[13px] text-slate-400">{p.email}</span>
            </span>
            <button type="button" onClick={p.onEditProfile} className="h-11 shrink-0 rounded-xl border border-slate-800 bg-slate-900 px-3.5 text-sm font-semibold text-slate-100">
              Editar
            </button>
          </div>

          <section className="flex flex-col gap-2">
            <span className={heading}>Esta semana</span>
            <button type="button" onClick={p.onChangeWeek} className={`${rowCls} min-h-16`}>
              <IconTile>
                <span className="text-[15px] font-bold">{p.activeWeek ?? '–'}</span>
              </IconTile>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[15px] font-semibold">Semana de trabalho</span>
                <span className="text-[13px] text-slate-400">{p.activeWeek ? `${p.activeWeek}ª semana do ciclo` : 'Não escolhida'}</span>
              </span>
              <span className="text-[13px] font-semibold text-blue-300">Trocar</span>
            </button>

            {p.activeWeek ? (
              <CityFilter
                pickMode
                options={p.cityOptions}
                selected={p.weekCities}
                onChange={p.onCitiesChange}
                renderTrigger={(open) => (
                  <button type="button" aria-haspopup="dialog" onClick={open} className={`${rowCls} min-h-16`}>
                    <IconTile>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                    </IconTile>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="text-[15px] font-semibold">Cidades</span>
                      <span className="truncate text-[13px] text-slate-400">{cities}</span>
                    </span>
                    <span className="text-[13px] font-semibold text-blue-300">Editar</span>
                  </button>
                )}
              />
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <span className={heading}>Notificações</span>
            <button
              type="button"
              role="switch"
              aria-checked={p.notifyOn}
              disabled={notifyBusy}
              onClick={() => void toggleNotify()}
              className={`${rowCls} min-h-16`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[15px] font-semibold">Receber avisos dos colegas</span>
                <span className="text-[13px] text-slate-400">Último paciente e Rep. no consultório</span>
              </span>
              <Switch on={p.notifyOn} />
            </button>
            {notifyMsg && <div role="alert" className="text-xs leading-snug text-red-400">{notifyMsg}</div>}
          </section>

          <section className="flex flex-col gap-2">
            <span className={heading}>Aparência</span>
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-0.5 rounded-[14px] border border-slate-800 bg-slate-900 p-[3px]">
              {THEMES.map((t) => {
                const on = p.themePref === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => p.onThemeChange(t.id)}
                    className={`h-11 rounded-[11px] border-0 text-sm ${on ? 'bg-blue-600 font-bold text-white' : 'bg-transparent font-semibold text-slate-400'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-slate-500">Na rua, ao sol, o tema claro lê melhor.</span>
          </section>

          <section className="flex flex-col gap-2">
            <span className={heading}>Ciclo</span>
            <button type="button" onClick={p.onRenewCycle} className={`${rowCls} min-h-16`}>
              <IconTile>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" />
                </svg>
              </IconTile>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[15px] font-semibold">Renovar ciclo</span>
                <span className="text-[13px] text-slate-400">
                  Zera os “visitados” do seu painel{p.cycleVisitedCount > 0 ? ` (${p.cycleVisitedCount})` : ''}
                </span>
              </span>
              <Chevron />
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={p.approvalOn}
              disabled={approvalBusy}
              onClick={() => void toggleApproval()}
              className={`${rowCls} min-h-16`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[15px] font-semibold">Aprovação de edições</span>
                <span className="text-[13px] leading-snug text-slate-400">
                  {p.approvalOn ? 'Nome, CRM, UF e especialidade pedem o ok de um colega. Vale para todos.' : 'Desligada: todos editam direto.'}
                </span>
              </span>
              <Switch on={p.approvalOn} />
            </button>
            {approvalMsg && <div role="alert" className="text-xs leading-snug text-red-400">{approvalMsg}</div>}
          </section>

          <section className="flex flex-col gap-2">
            <span className={heading}>Ajuda</span>
            <button type="button" onClick={p.onOpenGuide} className={`${rowCls} min-h-14`}>
              <IconTile round>
                <span className="text-base font-bold">?</span>
              </IconTile>
              <span className="flex-1 text-[15px] font-semibold">Guia de cores e status</span>
              <Chevron />
            </button>
            <button type="button" onClick={p.onReplayTour} className={`${rowCls} min-h-14`}>
              <IconTile round>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </IconTile>
              <span className="flex-1 text-[15px] font-semibold">Rever o tutorial</span>
              <Chevron />
            </button>
          </section>

          <button
            type="button"
            onClick={p.onLogout}
            className="mt-2 h-[52px] shrink-0 rounded-[14px] border border-slate-800 bg-slate-950 text-base font-semibold text-red-300 hover:bg-red-500/10"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
