'use client';

import { useState, type ReactNode } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CityFilter from '@/components/CityFilter';
import { RepAvatar } from '@/components/RepAvatar';
import type { CityOption } from '@/utils';
import type { ThemePref } from '@/lib/theme';
import { shortName } from '@/lib/visits';

interface ProfileSheetProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  /** semana de trabalho (null = ainda não escolheu) */
  activeWeek: number | null;
  cityOptions: CityOption[];
  /** cidades da semana (chaves) */
  weekCities: string[];
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

const section = 'flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-3.5';
const title = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';
const linkBtn =
  'h-11 shrink-0 rounded-xl border border-slate-700 bg-transparent px-4 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-40';

function Row({ label, value, action }: { label: string; value: ReactNode; action: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className={title}>{label}</span>
        <span className="truncate text-[15px] text-slate-100">{value}</span>
      </span>
      {action}
    </div>
  );
}

/** Meu perfil: foto/iniciais, nome, semana, cidades, ciclo, avisos, aparência, ajuda e sair */
export default function ProfileSheet(p: ProfileSheetProps) {
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalMsg, setApprovalMsg] = useState<string | null>(null);
  const toggleApproval = async () => {
    setApprovalBusy(true);
    setApprovalMsg(null);
    const err = await p.onToggleApproval(!p.approvalOn);
    setApprovalBusy(false);
    if (err) setApprovalMsg(err);
  };

  const toggleNotify = async () => {
    setNotifyBusy(true);
    setNotifyMsg(null);
    const err = await p.onToggleNotify(!p.notifyOn);
    setNotifyBusy(false);
    if (err) setNotifyMsg(err);
  };

  return (
    <BottomSheet title="Meu perfil" onClose={p.onClose}>
      <div className="flex items-center gap-4">
        <RepAvatar name={p.name || p.email} src={p.avatarUrl} me size={64} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xl font-bold leading-tight text-slate-50">{p.name || 'Sem nome'}</span>
          <span className="truncate text-sm text-slate-400">{shortName(p.name) ? `Aparece como ${shortName(p.name)}` : p.email}</span>
        </div>
      </div>
      <button type="button" onClick={p.onEditProfile} className={`${linkBtn} w-full`}>
        Editar perfil
      </button>

      <section className={section}>
        <Row
          label="Semana de trabalho"
          value={p.activeWeek ? `${p.activeWeek}ª semana do ciclo` : 'Não escolhida'}
          action={
            <button type="button" onClick={p.onChangeWeek} className={linkBtn}>
              Trocar
            </button>
          }
        />
        <div className="h-px bg-slate-800" />
        <div className="flex flex-col gap-1.5">
          <span className={title}>Cidades{p.activeWeek ? ` da ${p.activeWeek}ª semana` : ''}</span>
          {p.activeWeek ? (
            <CityFilter pickMode options={p.cityOptions} selected={p.weekCities} onChange={p.onCitiesChange} />
          ) : (
            <span className="text-sm text-slate-400">Escolha a semana de trabalho para marcar as cidades.</span>
          )}
        </div>
        <div className="h-px bg-slate-800" />
        <Row
          label="Ciclo"
          value={`${p.cycleVisitedCount} visitado${p.cycleVisitedCount === 1 ? '' : 's'} no seu painel`}
          action={
            <button type="button" onClick={p.onRenewCycle} className={linkBtn}>
              Renovar ciclo
            </button>
          }
        />
      </section>

      <section className={section}>
        <button
          type="button"
          role="switch"
          aria-checked={p.notifyOn}
          disabled={notifyBusy}
          onClick={() => void toggleNotify()}
          className="flex min-h-12 items-center justify-between gap-3 border-0 bg-transparent p-0 text-left"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-slate-100">Avisos dos colegas</span>
            <span className="text-xs text-slate-400">&quot;Último paciente&quot; e &quot;Rep. no consultório&quot; das cidades da semana</span>
          </span>
          <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${p.notifyOn ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${p.notifyOn ? 'left-6' : 'left-1'}`} />
          </span>
        </button>
        {notifyMsg && <div role="alert" className="text-xs leading-snug text-red-400">{notifyMsg}</div>}
      </section>

      <section className={section}>
        <button
          type="button"
          role="switch"
          aria-checked={p.approvalOn}
          disabled={approvalBusy}
          onClick={() => void toggleApproval()}
          className="flex min-h-12 items-center justify-between gap-3 border-0 bg-transparent p-0 text-left"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-slate-100">Aprovação de edições</span>
            <span className="text-xs text-slate-400">
              {p.approvalOn
                ? 'Ligada: mudar nome, CRM, UF ou especialidade de um médico pede o ok de um colega (ou vale sozinho em 24 h). Vale para todos.'
                : 'Desligada: todos editam direto. Ligue se quiser que um colega confirme mudanças de nome, CRM, UF e especialidade.'}
            </span>
          </span>
          <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${p.approvalOn ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${p.approvalOn ? 'left-6' : 'left-1'}`} />
          </span>
        </button>
        {approvalMsg && <div role="alert" className="text-xs leading-snug text-red-400">{approvalMsg}</div>}
      </section>

      <section className={section}>
        <span className={title}>Aparência</span>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Aparência">
          {THEMES.map((t) => {
            const on = p.themePref === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => p.onThemeChange(t.id)}
                className={`h-12 rounded-xl text-sm ${on ? 'border-0 bg-blue-600 font-bold text-white' : 'border border-slate-700 bg-slate-900 text-slate-200'}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className={section}>
        <span className={title}>Ajuda</span>
        <button type="button" onClick={p.onOpenGuide} className={`${linkBtn} text-left`}>
          Guia de cores e status
        </button>
        <button type="button" onClick={p.onReplayTour} className={`${linkBtn} text-left`}>
          Rever o tutorial
        </button>
      </section>

      <button
        type="button"
        onClick={p.onLogout}
        className="h-12 rounded-xl border border-red-500/40 bg-transparent text-sm font-semibold text-red-400 hover:bg-red-500/10"
      >
        Sair da conta
      </button>
    </BottomSheet>
  );
}
