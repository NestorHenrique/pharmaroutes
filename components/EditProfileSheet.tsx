'use client';

import { useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import PasswordForm from '@/components/PasswordForm';
import { RepAvatar } from '@/components/RepAvatar';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import { changePassword } from '@/lib/auth';
import { shortName } from '@/lib/visits';

interface EditProfileSheetProps {
  email: string;
  name: string;
  avatarUrl: string | null;
  onSave: (patch: { display_name?: string | null; avatar_url?: string | null }) => Promise<boolean>;
  onClose: () => void;
}

const inputCls =
  'w-full min-w-0 box-border h-[52px] px-3.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base outline-hidden placeholder:text-slate-500 focus-visible:border-blue-600';
const label = 'text-xs font-semibold text-slate-300';

/** Editar perfil: foto, nome, e-mail (só leitura) e trocar senha */
export default function EditProfileSheet({ email, name, avatarUrl, onSave, onClose }: EditProfileSheetProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [nome, setNome] = useState(name);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      if (await onSave({ avatar_url: dataUrl })) setAvatar(dataUrl);
      else setPhotoMsg('Não foi possível salvar a foto. Tente de novo.');
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
    if (await onSave({ avatar_url: null })) setAvatar(null);
    else setPhotoMsg('Não foi possível remover a foto.');
    setPhotoBusy(false);
  };

  const dirty = nome.trim() !== name.trim() && nome.trim().length >= 2;
  const saveName = async () => {
    setSaving(true);
    setSaveMsg(null);
    const ok = await onSave({ display_name: nome.trim() });
    setSaving(false);
    setSaveMsg(ok ? { ok: true, text: 'Nome salvo.' } : { ok: false, text: 'Não foi possível salvar. Tente de novo.' });
  };

  return (
    <BottomSheet title="Editar perfil" onClose={onClose}>
      <div className="flex items-center gap-4">
        <RepAvatar name={nome || email} src={avatar} me size={72} />
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void changePhoto(e.target.files?.[0])} />
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => fileRef.current?.click()}
            className="h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm font-semibold text-slate-100 disabled:opacity-40"
          >
            {photoBusy ? 'Aguarde…' : avatar ? 'Trocar foto' : 'Escolher foto'}
          </button>
          {avatar && (
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => void removePhoto()}
              className="h-9 self-start border-0 bg-transparent p-0 text-sm font-semibold text-red-400 hover:underline disabled:opacity-40"
            >
              Remover foto
            </button>
          )}
        </div>
      </div>
      {photoMsg && <div role="alert" className="text-xs text-red-400">{photoMsg}</div>}

      <label className="flex flex-col gap-1">
        <span className={label}>Nome que os colegas veem</span>
        <input type="text" autoComplete="name" autoCapitalize="words" value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        <span className="text-xs text-slate-500">Aparece nos status e nas visitas. Ex.: &quot;{shortName(nome) || '—'} · 16:55&quot;.</span>
      </label>
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() => void saveName()}
        className="h-[52px] rounded-[14px] border-0 bg-blue-600 text-base font-bold text-white hover:bg-blue-500 disabled:opacity-40"
      >
        {saving ? 'Salvando…' : 'Salvar nome'}
      </button>
      {saveMsg && (
        <div role="status" className={`text-xs ${saveMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {saveMsg.text}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className={label}>E-mail de acesso</span>
        <input type="email" value={email} readOnly aria-readonly="true" className={`${inputCls} border-slate-800 text-slate-500`} />
        <span className="text-xs text-slate-500">O e-mail não pode ser alterado por aqui.</span>
      </label>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-3.5">
        <span className={label}>Trocar senha</span>
        <PasswordForm requireCurrent submitLabel="Trocar senha" onSubmit={(cur, next) => changePassword(email, cur, next)} />
      </div>
    </BottomSheet>
  );
}
