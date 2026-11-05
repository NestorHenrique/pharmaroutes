import { memo, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Doctor } from '@/types/doctor';
import { OPCOES_DIAS, OPCOES_TURNO } from '@/constants';
import { isRecentDoctor } from '@/utils';
import {
  BuildingIcon,
  LocateIcon,
  MapPinIcon,
  MessageIcon,
  NavigationIcon,
  PencilIcon,
  SpinnerIcon,
  TrashIcon,
} from '../ui/Icons';

interface DoctorCardProps {
  doc: Doctor;
  onUpdateShift: (docId: string, newTurno: string, docName: string) => void;
  onUpdateDoctor: (docId: string, updatedData: Partial<Doctor>, docName: string) => Promise<boolean>;
  onDeleteDoctor: (doc: Doctor) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Fonte única de verdade para ler a string "seg, ter, qua" -> ['seg','ter','qua'].
const parseDays = (value?: string | null): string[] =>
  (value ?? '')
    .toLowerCase()
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

const toggleDay = (current: string | undefined, day: string): string => {
  const set = new Set(parseDays(current));
  if (set.has(day)) set.delete(day);
  else set.add(day);
  return [...set].join(', ');
};

// "qui", "sex", "sab"... sempre no fuso de São Paulo, sem acento.
const getTodayKey = (): string =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' })
    .format(new Date())
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('.', '')
    .slice(0, 3)
    .toLowerCase();

const buildWhatsAppUrl = (phone: string): string | null => {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 10) return null;
  // Só considera que já tem código do país se o tamanho bater (55 + DDD + 8/9 dígitos).
  const full = digits.length >= 12 && digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
};

// Estilos compartilhados (mantêm o card consistente e o foco sempre visível).
// `outline-none` funciona no Tailwind v3 e v4.
const ringOnCard =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900';
const labelClass = 'flex min-w-0 flex-col gap-1.5 text-xs font-medium text-slate-300';
// 16px no mobile evita o zoom automático do iOS ao focar o campo.
const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 text-base text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-700 focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:text-sm';

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

function DoctorCard({ doc, onUpdateShift, onUpdateDoctor, onDeleteDoctor }: DoctorCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Doctor>>({});
  const [gettingLocation, setGettingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const uid = useId();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // Devolve o foco ao botão "Editar" depois de salvar/cancelar (acessibilidade).
  useEffect(() => {
    if (!isEditing && returnFocus.current) {
      returnFocus.current = false;
      editButtonRef.current?.focus();
    }
  }, [isEditing]);

  const currentShift = doc.turno || 'Manhã e Tarde';
  const isRecent = isRecentDoctor(doc.created_at);

  // `??` (e não `||`) para permitir limpar todos os dias sem cair no campo legado.
  const rawDays = doc.dias_semana ?? doc.dia_semana ?? '';
  const dayKeys = parseDays(rawDays);
  const todayKey = getTodayKey();
  const attendsToday = dayKeys.includes(todayKey);

  const setField = <K extends keyof Doctor>(key: K, value: Doctor[K]) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  const closeEdit = () => {
    returnFocus.current = true;
    setFormError(null);
    setGpsStatus(null);
    setIsEditing(false);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus({ type: 'error', text: 'Geolocalização não suportada neste aparelho.' });
      return;
    }
    setGettingLocation(true);
    setGpsStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setField('map_link', `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
        setGpsStatus({ type: 'ok', text: 'Localização capturada.' });
        setGettingLocation(false);
      },
      () => {
        setGpsStatus({ type: 'error', text: 'Não foi possível capturar o GPS. Verifique a permissão.' });
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleStartEdit = () => {
    setFormError(null);
    setGpsStatus(null);
    setEditForm({
      dias_semana: rawDays,
      complemento: doc.complemento ?? '',
      endereco: doc.endereco ?? '',
      numero: doc.numero ?? '',
      bairro: doc.bairro ?? '',
      cidade: doc.cidade ?? '',
      observacoes: doc.observacoes ?? '',
      telefone: doc.telefone ?? '',
      map_link: doc.map_link ?? '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const success = await onUpdateDoctor(doc.id, editForm, doc.descricao || '');
      if (success) closeEdit();
      else setFormError('Não foi possível salvar. Tente novamente.');
    } catch {
      setFormError('Erro de conexão ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Permite salvar com Enter dentro dos campos (o botão Salvar é type="submit").
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSave();
  };

  const openNavigation = () => {
    const link = doc.map_link?.trim();
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    const parts = [
      [doc.endereco, doc.numero || 'SN'].filter(Boolean).join(', '),
      doc.bairro,
      doc.cidade,
    ].filter(Boolean);
    if (!doc.endereco || parts.length === 0) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(', '))}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const whatsAppUrl = doc.telefone ? buildWhatsAppUrl(doc.telefone) : null;
  const canNavigate = Boolean(doc.map_link?.trim() || doc.endereco);

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border bg-slate-900 p-4 shadow-lg shadow-black/20 transition-colors hover:border-slate-700 sm:p-5 ${
        attendsToday ? 'border-emerald-500/40' : 'border-slate-800'
      }`}
    >
      {/* Header do Card */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="mb-1.5 break-words text-base font-semibold uppercase leading-snug tracking-tight text-slate-100 sm:text-[17px]">
            {doc.descricao}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {attendsToday && (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                ATENDE HOJE
              </span>
            )}
            {isRecent && (
              <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-300">NOVO</span>
            )}
            {doc.crm && <span className="text-xs font-medium text-slate-400">CRM {doc.crm.toUpperCase()}</span>}
            {dayKeys.map((d) => {
              const isToday = d === todayKey;
              return (
                <span
                  key={d}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    isToday
                      ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                      : 'border-blue-500/30 bg-blue-600/15 text-blue-300'
                  }`}
                >
                  {d.toUpperCase()}
                </span>
              );
            })}
          </div>
        </div>

        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              ref={editButtonRef}
              type="button"
              onClick={handleStartEdit}
              aria-label={`Editar ${doc.descricao}`}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/60 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 ${ringOnCard}`}
            >
              <PencilIcon className="size-4" />
              <span className="hidden sm:inline">Editar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Excluir ${doc.descricao}?`)) onDeleteDoctor(doc);
              }}
              aria-label={`Excluir ${doc.descricao}`}
              className={`grid size-10 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20 ${ringOnCard}`}
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        )}
      </header>

      {/* Modo Edição */}
      {isEditing ? (
        <form
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeEdit();
          }}
          aria-label={`Editar ${doc.descricao}`}
          className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 sm:p-4"
        >
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-400">
              Dias de atendimento
            </legend>
            <div className="flex gap-1">
              {OPCOES_DIAS.map((d) => {
                const isChecked = parseDays(editForm.dias_semana).includes(d.value);
                return (
                  <button
                    type="button"
                    key={d.value}
                    aria-pressed={isChecked}
                    onClick={() => setField('dias_semana', toggleDay(editForm.dias_semana, d.value))}
                    className={`min-h-10 flex-1 rounded-lg border text-xs font-semibold transition-colors ${ringOnCard} ${
                      isChecked
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className={labelClass}>
            Clínica / consultório
            <input
              type="text"
              placeholder="Nome da Clínica / Consultório"
              value={editForm.complemento ?? ''}
              onChange={(e) => setField('complemento', e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <label className={labelClass}>
              Endereço
              <input
                type="text"
                placeholder="Endereço"
                value={editForm.endereco ?? ''}
                onChange={(e) => setField('endereco', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Número
              <input
                type="text"
                inputMode="numeric"
                placeholder="Nº"
                value={editForm.numero ?? ''}
                onChange={(e) => setField('numero', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Bairro
              <input
                type="text"
                placeholder="Bairro"
                value={editForm.bairro ?? ''}
                onChange={(e) => setField('bairro', e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Cidade
              <input
                type="text"
                placeholder="Cidade"
                value={editForm.cidade ?? ''}
                onChange={(e) => setField('cidade', e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-map`} className="text-xs font-medium text-slate-300">
              Link do Google Maps
            </label>
            <div className="flex gap-2">
              <input
                id={`${uid}-map`}
                type="url"
                inputMode="url"
                placeholder="https://maps.google.com/..."
                value={editForm.map_link ?? ''}
                onChange={(e) => setField('map_link', e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                disabled={gettingLocation}
                onClick={getCurrentLocation}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60 ${ringOnCard}`}
              >
                {gettingLocation ? <SpinnerIcon className="size-4 animate-spin" /> : <LocateIcon className="size-4" />}
                <span>{gettingLocation ? 'Buscando...' : 'GPS atual'}</span>
              </button>
            </div>
            {gpsStatus && (
              <p
                role="status"
                className={`text-xs ${gpsStatus.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {gpsStatus.text}
              </p>
            )}
          </div>

          <label className={labelClass}>
            Telefone
            <input
              type="tel"
              inputMode="tel"
              placeholder="(86) 99999-9999"
              value={editForm.telefone ?? ''}
              onChange={(e) => setField('telefone', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Observações
            <input
              type="text"
              placeholder="Observações"
              value={editForm.observacoes ?? ''}
              onChange={(e) => setField('observacoes', e.target.value)}
              className={inputClass}
            />
          </label>

          {formError && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {formError}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEdit}
              className={`h-10 rounded-xl bg-slate-800 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 ${ringOnCard}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60 ${ringOnCard}`}
            >
              {saving && <SpinnerIcon className="size-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : (
        /* Modo Visualização */
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-300">
            <BuildingIcon className="size-4 shrink-0" />
            <span className="min-w-0 break-words">{doc.complemento ? doc.complemento : 'Consultório Próprio'}</span>
          </div>
          <div className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-300">
            <MapPinIcon className="mt-0.5 size-4 shrink-0 text-slate-500" />
            <span className="min-w-0 break-words">
              {doc.endereco}
              {doc.numero && `, ${doc.numero}`}
              {doc.bairro && <span className="text-slate-400"> — {doc.bairro.toUpperCase()}</span>}
              {doc.cidade && <span className="font-semibold text-blue-400"> ({doc.cidade.toUpperCase()})</span>}
            </span>
          </div>
        </div>
      )}

      {/* OBS em Destaque */}
      {!isEditing && doc.observacoes && (
        <div
          role="note"
          className="rounded-r-lg border-l-4 border-blue-500 bg-blue-500/10 px-3 py-2.5 text-xs leading-relaxed text-blue-100"
        >
          <strong className="font-semibold text-blue-300">OBS:</strong> {doc.observacoes}
        </div>
      )}

      {/* Rodapé do Card */}
      {!isEditing && (
        <footer className="flex flex-col gap-3 border-t border-slate-800/80 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="group"
            aria-label="Turno de atendimento"
            className="flex rounded-full border border-slate-800 bg-slate-950/60 p-0.5"
          >
            {OPCOES_TURNO.map((opcao) => {
              const isSelected = currentShift === opcao;
              return (
                <button
                  key={opcao}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onUpdateShift(doc.id, opcao, doc.descricao || '')}
                  className={`min-h-9 flex-1 rounded-full px-3 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:flex-none ${
                    isSelected
                      ? 'bg-blue-600 font-semibold text-white'
                      : 'font-medium text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {opcao === 'Manhã e Tarde' ? 'Integral' : opcao}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={openNavigation}
              disabled={!canNavigate}
              className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white shadow-md shadow-blue-950/30 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${ringOnCard}`}
            >
              <NavigationIcon className="size-4" />
              GPS
              <span className="sr-only"> — abrir rota para {doc.descricao}</span>
            </button>
            {whatsAppUrl && (
              <button
                type="button"
                onClick={() => window.open(whatsAppUrl, '_blank', 'noopener,noreferrer')}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 sm:flex-none ${ringOnCard}`}
              >
                <MessageIcon className="size-4" />
                WhatsApp
                <span className="sr-only"> — conversar com {doc.descricao}</span>
              </button>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}

// memo evita re-renderizar todos os cards quando só um muda.
// No componente pai, envolva os handlers com useCallback para o memo funcionar.
export default memo(DoctorCard);
