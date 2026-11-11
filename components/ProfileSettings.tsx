'use client';

import { useEffect, useRef, useState } from 'react';
import type { RepProfile } from '@/types/doctor';
import { ESPECIALIDADES } from '@/constants';
import { RepAvatar } from '@/components/RepAvatar';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import { getPushCity, getPushSupport, sendTestPush, subscribeToCity, unsubscribePush } from '@/lib/push';

interface ProfileSettingsProps {
  userId: string;
  email: string;
  profile: RepProfile;
  cities: string[];
  onSave: (patch: Partial<Omit<RepProfile, 'user_id'>>) => Promise<boolean>;
  onClose: () => void;
  theme: 'onix' | 'marfim';
  onToggleTheme: () => void;
  onLogout: () => void;
  /** filtro "Minha carteira" ligado */
  portfolioActive: boolean;
  onTogglePortfolio: () => void;
  /** semana do ciclo que o representante está visitando (null = não escolhida) */
  activeWeekLabel: string | null;
  onChangeWeek: () => void;
  /** visitados no ciclo atual */
  cycleVisitedCount: number;
  onRenewCycle: () => void;
}

const inputCls =
  'w-full h-12 box-border px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-base text-slate-100 outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';
const cardCls = 'rounded-2xl border border-slate-800 bg-slate-950 p-4 flex flex-col gap-3';
const titleCls = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400';

export default function ProfileSettings({
  userId,
  email,
  profile,
  cities,
  onSave,
  onClose,
  theme,
  onToggleTheme,
  onLogout,
  portfolioActive,
  onTogglePortfolio,
  activeWeekLabel,
  onChangeWeek,
  cycleVisitedCount,
  onRenewCycle,
}: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [specialties, setSpecialties] = useState<string[]>(profile.specialties);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Foto de perfil: salva na hora ao escolher/remover
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const ok = await onSave({ avatar_url: dataUrl });
      if (ok) setAvatar(dataUrl);
      else setPhotoMsg('Não foi possível salvar a foto. Tente novamente.');
    } catch (err) {
      setPhotoMsg((err as Error).message || 'Não foi possível usar essa foto.');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setPhotoMsg(null);
    const ok = await onSave({ avatar_url: null });
    if (ok) setAvatar(null);
    else setPhotoMsg('Não foi possível remover a foto.');
    setPhotoBusy(false);
  };

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

  // Esc fecha; a página por trás não rola
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const dirty =
    (displayName.trim() || null) !== (profile.display_name ?? null) ||
    specialties.slice().sort().join() !== profile.specialties.slice().sort().join();

  const toggleSpecialty = (code: string) =>
    setSpecialties((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const ok = await onSave({ display_name: displayName.trim() || null, specialties });
    setSaving(false);
    setSaveMsg(ok ? 'Perfil salvo.' : 'Não foi possível salvar. Tente novamente.');
  };

  const handleSubscribe = async () => {
    setPushBusy(true);
    const r = await subscribeToCity(userId, cityChoice);
    setPushBusy(false);
    setPushMsg(r.message);
    if (r.ok) setPushCity(cityChoice.trim());
  };

  const handleTest = async () => {
    setPushBusy(true);
    const r = await sendTestPush();
    setPushBusy(false);
    setPushMsg(r.message);
  };

  const handleUnsubscribe = async () => {
    setPushBusy(true);
    const r = await unsubscribePush();
    setPushBusy(false);
    setPushMsg(r.message);
    if (r.ok) setPushCity(null);
  };

  const themes: { id: 'onix' | 'marfim'; name: string; hint: string; bg: string; card: string; accent: string }[] = [
    { id: 'onix', name: 'Ônix', hint: 'Escuro · violeta', bg: '#0B0B12', card: '#14141D', accent: '#A78BFA' },
    { id: 'marfim', name: 'Marfim', hint: 'Claro · violeta', bg: '#F7F6FB', card: '#FFFFFF', accent: '#5B3FD0' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 animate-[fade-in_.18s_ease-out]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meu perfil"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border-t sm:border border-slate-700 bg-slate-900 px-5 pt-2.5 flex flex-col gap-4 animate-[sheet-up_.24s_cubic-bezier(.2,.8,.2,1)]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
      >
        <div className="self-center h-[5px] w-10 rounded-full bg-slate-700 sm:hidden" aria-hidden="true" />

        {/* Identidade */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            aria-label="Trocar foto de perfil"
            className="relative size-14 shrink-0 rounded-full border-0 bg-transparent p-0 disabled:opacity-60"
          >
            <RepAvatar name={displayName.trim() || email.split('@')[0] || 'Eu'} src={avatar} size={56} me className="text-lg" />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-700 text-slate-100" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void changePhoto(e.target.files?.[0])}
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <h2 className="m-0 text-xl font-bold tracking-tight text-white truncate">{displayName.trim() || 'Meu perfil'}</h2>
            <span className="text-sm text-slate-400 truncate">{email}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="size-11 shrink-0 rounded-xl border border-slate-700 bg-transparent text-slate-200 flex items-center justify-center hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {(avatar || photoMsg) && (
          <div className="-mt-2 flex items-center gap-3 text-xs">
            {avatar && (
              <button
                type="button"
                onClick={() => void removePhoto()}
                disabled={photoBusy}
                className="border-0 bg-transparent p-0 text-slate-400 underline disabled:opacity-60"
              >
                Remover foto
              </button>
            )}
            {photoMsg && <span role="status" className="text-red-400">{photoMsg}</span>}
          </div>
        )}

        {/* Nome */}
        <section className={cardCls}>
          <label className={titleCls} htmlFor="display-name">
            Seu nome
          </label>
          <input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Como aparece em “Visitado” e “Atualizado por”"
            className={inputCls}
          />
        </section>

        {/* Ciclo de visitas */}
        <section className={cardCls}>
          <span className={titleCls}>Ciclo de visitas</span>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm text-slate-300">Semana que estou visitando</span>
              <span className="text-base font-semibold text-white">{activeWeekLabel ?? 'Não escolhida'}</span>
            </div>
            <button
              type="button"
              onClick={onChangeWeek}
              className="h-10 px-4 shrink-0 rounded-xl border border-slate-700 bg-transparent text-sm text-slate-200 hover:text-white"
            >
              Trocar
            </button>
          </div>
          <div className="h-px bg-slate-800" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">
              {cycleVisitedCount} médico{cycleVisitedCount !== 1 ? 's' : ''} visitado{cycleVisitedCount !== 1 ? 's' : ''} neste ciclo
            </span>
            <button
              type="button"
              onClick={onRenewCycle}
              disabled={cycleVisitedCount === 0}
              className="h-10 px-4 shrink-0 rounded-xl border-0 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
            >
              Renovar ciclo
            </button>
          </div>
        </section>

        {/* Carteira */}
        <section className={cardCls}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className={titleCls}>Minha carteira</span>
              <span className="text-sm text-slate-300">Mostrar só as especialidades que visito</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={portfolioActive}
              aria-label="Filtrar pela minha carteira"
              onClick={onTogglePortfolio}
              disabled={profile.specialties.length === 0}
              className={`relative h-8 w-14 shrink-0 rounded-full border-0 transition-colors disabled:opacity-40 ${
                portfolioActive ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-slate-100 transition-[left] ${portfolioActive ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {ESPECIALIDADES.map((e) => {
              const active = specialties.includes(e.code);
              return (
                <button
                  type="button"
                  key={e.code}
                  aria-pressed={active}
                  onClick={() => toggleSpecialty(e.code)}
                  title={e.label}
                  className={`min-h-12 flex flex-col items-start justify-center rounded-xl border px-2.5 py-1.5 text-left ${
                    active ? 'border-blue-600 bg-blue-600/15 text-white' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold">{e.code}</span>
                  <span className="text-[10px] leading-tight truncate w-full">{e.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {(dirty || saveMsg) && (
          <div className="flex items-center gap-3">
            {dirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-12 flex-1 rounded-xl border-0 bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            )}
            {saveMsg && <span className="text-sm text-slate-400">{saveMsg}</span>}
          </div>
        )}

        {/* Aparência */}
        <section className={cardCls}>
          <span className={titleCls}>Aparência</span>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => !active && onToggleTheme()}
                  className={`rounded-xl border p-2.5 text-left flex flex-col gap-2 ${
                    active ? 'border-blue-600' : 'border-slate-800'
                  } bg-slate-900`}
                >
                  <span
                    aria-hidden="true"
                    className="h-12 rounded-lg flex items-end gap-1 p-1.5"
                    style={{ background: t.bg, border: '1px solid rgba(128,128,128,0.25)' }}
                  >
                    <span className="h-5 flex-1 rounded" style={{ background: t.card }} />
                    <span className="h-5 w-5 rounded" style={{ background: t.accent }} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-white">
                      {active ? '● ' : ''}
                      {t.name}
                    </span>
                    <span className="text-xs text-slate-400">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Notificações */}
        <section className={cardCls}>
          <div className="flex flex-col">
            <span className={titleCls}>Notificações</span>
            <span className="text-sm text-slate-300">“Último paciente” e “Rep. no consultório” da sua cidade</span>
          </div>

          {support === 'unsupported' && (
            <p className="m-0 text-sm text-amber-400">
              Este navegador não suporta notificações. No iPhone, instale o app na Tela de Início e abra por lá.
            </p>
          )}
          {support === 'no-key' && (
            <p className="m-0 text-sm text-amber-400">Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY no ambiente do app.</p>
          )}
          {support === 'denied' && (
            <p className="m-0 text-sm text-amber-400">Notificações bloqueadas. Libere nas configurações do aparelho.</p>
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
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={pushBusy || !cityChoice}
                  className="h-11 px-4 rounded-xl border-0 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {pushCity ? 'Trocar cidade' : 'Ativar notificações'}
                </button>
                {pushCity && (
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={pushBusy}
                    className="h-11 px-4 rounded-xl border border-slate-700 bg-transparent text-slate-200 text-sm disabled:opacity-50"
                  >
                    Enviar teste
                  </button>
                )}
                {pushCity && (
                  <button
                    type="button"
                    onClick={handleUnsubscribe}
                    disabled={pushBusy}
                    className="h-11 px-4 rounded-xl border border-slate-700 bg-transparent text-slate-400 text-sm disabled:opacity-50"
                  >
                    Desativar
                  </button>
                )}
              </div>
              {pushCity && !pushMsg && <span className="text-sm text-emerald-400">Ativo neste aparelho: {pushCity}</span>}
            </>
          )}
          {pushMsg && <span className="text-sm text-slate-300">{pushMsg}</span>}
        </section>

        <button
          type="button"
          onClick={onLogout}
          className="h-12 rounded-xl border border-red-500/40 bg-transparent text-red-400 text-sm font-semibold hover:bg-red-500/10"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}
