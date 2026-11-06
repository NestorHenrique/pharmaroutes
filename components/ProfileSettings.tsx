'use client';

import { useEffect, useState } from 'react';
import type { RepProfile } from '@/types/doctor';
import { ESPECIALIDADES } from '@/constants';
import { getPushCity, getPushSupport, subscribeToCity, unsubscribePush } from '@/lib/push';

interface ProfileSettingsProps {
  userId: string;
  profile: RepProfile;
  cities: string[];
  onSave: (patch: Partial<Omit<RepProfile, 'user_id'>>) => Promise<boolean>;
  onClose: () => void;
}

const inputCls =
  'w-full box-border p-2 rounded border border-slate-700 bg-slate-800 text-slate-100 text-xs outline-hidden placeholder:text-slate-500';

export default function ProfileSettings({ userId, profile, cities, onSave, onClose }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [specialties, setSpecialties] = useState<string[]>(profile.specialties);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Push
  const [pushCity, setPushCity] = useState<string | null>(null);
  const [cityChoice, setCityChoice] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const support = getPushSupport();

  useEffect(() => {
    getPushCity().then((c) => {
      setPushCity(c);
      if (c) setCityChoice(c);
    });
  }, []);

  const toggleSpecialty = (code: string) =>
    setSpecialties((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const ok = await onSave({ display_name: displayName.trim() || null, specialties });
    setSaving(false);
    setSaveMsg(ok ? 'Perfil salvo.' : 'Não foi possível salvar. A migração v3 já foi rodada?');
  };

  const handleSubscribe = async () => {
    setPushBusy(true);
    const r = await subscribeToCity(userId, cityChoice);
    setPushBusy(false);
    setPushMsg(r.message);
    if (r.ok) setPushCity(cityChoice.trim());
  };

  const handleUnsubscribe = async () => {
    setPushBusy(true);
    const r = await unsubscribePush();
    setPushBusy(false);
    setPushMsg(r.message);
    if (r.ok) setPushCity(null);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Meu perfil"
        className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="m-0 text-sm font-bold text-white">Meu perfil</h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-slate-400 text-lg leading-none px-1 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Nome */}
        <section className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-400" htmlFor="display-name">
            Seu nome (aparece em &quot;Atualizado por&quot; e em &quot;Visitado&quot;)
          </label>
          <input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome"
            className={inputCls}
          />
        </section>

        {/* Especialidades */}
        <section className="flex flex-col gap-1.5">
          <span className="text-[11px] text-slate-400">
            Especialidades que você visita (filtro &quot;Minha carteira&quot;)
          </span>
          <div className="grid grid-cols-3 gap-1">
            {ESPECIALIDADES.map((e) => {
              const active = specialties.includes(e.code);
              return (
                <button
                  type="button"
                  key={e.code}
                  aria-pressed={active}
                  onClick={() => toggleSpecialty(e.code)}
                  title={e.label}
                  className={`flex flex-col items-start rounded border px-1.5 py-1 text-left ${
                    active
                      ? 'border-rose-500 bg-rose-500/15 text-rose-200'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-bold">{e.code}</span>
                  <span className="text-[9px] leading-tight truncate w-full">{e.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 text-white border-none rounded text-xs font-semibold hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
            {saveMsg && <span className="text-[11px] text-slate-400">{saveMsg}</span>}
          </div>
        </section>

        {/* Notificações */}
        <section className="flex flex-col gap-1.5 border-t border-slate-800 pt-3">
          <span className="text-[11px] text-slate-400">
            Notificações de &quot;Último Paciente&quot; e &quot;Rep. no Consultório&quot; da cidade:
          </span>

          {support === 'unsupported' && (
            <p className="m-0 text-[11px] text-amber-400">
              Este navegador não suporta notificações. No iPhone, instale o app na Tela de Início e abra por lá.
            </p>
          )}
          {support === 'no-key' && (
            <p className="m-0 text-[11px] text-amber-400">
              Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY no ambiente do app.
            </p>
          )}
          {support === 'denied' && (
            <p className="m-0 text-[11px] text-amber-400">
              Notificações bloqueadas para este site. Libere nas configurações do navegador.
            </p>
          )}

          {support === 'ok' && (
            <>
              <select
                value={cityChoice}
                onChange={(e) => setCityChoice(e.target.value)}
                aria-label="Cidade das notificações"
                className={inputCls}
              >
                <option value="">Escolha a cidade</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleSubscribe}
                  disabled={pushBusy || !cityChoice}
                  className="px-3 py-1.5 bg-emerald-600 text-white border-none rounded text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {pushCity ? 'Trocar cidade' : '🔔 Ativar notificações'}
                </button>
                {pushCity && (
                  <button
                    onClick={handleUnsubscribe}
                    disabled={pushBusy}
                    className="px-3 py-1.5 bg-slate-700 text-slate-200 border-none rounded text-xs hover:bg-slate-600 disabled:opacity-50"
                  >
                    Desativar
                  </button>
                )}
              </div>
              {pushCity && !pushMsg && (
                <span className="text-[11px] text-emerald-400">Ativo neste aparelho: {pushCity}</span>
              )}
            </>
          )}
          {pushMsg && <span className="text-[11px] text-slate-300">{pushMsg}</span>}
        </section>
      </div>
    </div>
  );
}
