'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Doctor, Shift } from '@/types/doctor';
import type { DoctorStatus, DoctorStatusType } from '@/types/status';
import { STATUS_META } from '@/types/status';
import BottomSheet from '@/components/BottomSheet';
import { RepAvatar } from '@/components/RepAvatar';
import type { PublicProfile, VisitMap } from '@/lib/visits';
import { shortName } from '@/lib/visits';
import { dayTime, eventRepName, fetchStatusEventsSince, type StatusEventRow } from '@/lib/statusHistory';
import { ESPECIALIDADES, FILTROS_PLANTAO, FILTROS_TURNO } from '@/constants';
import { cityKey, getAgenda, matchesLocation, prettyCity, shiftCovers, specialtyCode } from '@/utils';

/* ── Tela geral de Status: todos os médicos que algum representante marcou, agrupados pelo status atual ── */

/** Ordem dos grupos na tela */
type GroupType = DoctorStatusType | 'visitado';

const GROUPS: { type: GroupType; label: string; dot: string }[] = [
  { type: 'representante_no_consultorio', label: 'No consultório', dot: 'bg-sky-400' },
  { type: 'ultimo_paciente', label: 'Último paciente', dot: 'bg-red-400' },
  { type: 'aguardando_medico', label: 'Aguardando', dot: 'bg-amber-400' },
  { type: 'visitado', label: 'Visitados', dot: 'bg-emerald-400' },
  { type: 'finalizou_atendimento', label: 'Finalizou', dot: 'bg-slate-400' },
  { type: 'nao_veio_hoje', label: 'Não veio hoje', dot: 'bg-slate-500' },
  { type: 'ferias', label: 'Licença / Afastado', dot: 'bg-amber-500' },
  { type: 'viajando', label: 'Férias / Viagem', dot: 'bg-amber-500' },
];
const GROUP_TYPES = new Set<string>(GROUPS.map((g) => g.type));

/** Hoje: visão coletiva em tempo real, tudo o que está acontecendo. 7 e 30 dias: histórico, só os registros
 *  consolidados (sem "No consultório", "Aguardando" e demais status passageiros do momento). */
const HISTORY_TYPES = new Set<GroupType>(['visitado', 'nao_veio_hoje', 'ferias', 'viajando']);
const typeShown = (type: GroupType, period: number) => period === 1 || HISTORY_TYPES.has(type);

const PERIODS = [
  { value: 1, label: 'Hoje' },
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

const LOCAIS = [{ value: 'consultorio', label: 'Consultório' }, ...FILTROS_PLANTAO] as const;

interface Mark {
  type: GroupType;
  at: string;
  repName: string;
  userId: string | null;
  returnDate: string | null;
  /** ainda vale agora (não expirou) */
  active: boolean;
}

interface StatusOverviewProps {
  /** todos os médicos da base (a visão coletiva inclui quem está fora da rota/painel deste rep) */
  doctors: readonly Doctor[];
  /** visitas de todos os representantes (doctor_visits) */
  visitMap: VisitMap;
  /** status ativos agora, por médico (já chega em tempo real) */
  statusMap: Readonly<Record<string, DoctorStatus[]>>;
  profiles: Readonly<Record<string, PublicProfile>>;
  myId: string | null;
  onOpenDoctor: (id: string) => void;
  onClose: () => void;
}

function startOfPeriod(days: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function chip(on: boolean): string {
  return `h-8 px-3 rounded-full text-xs whitespace-nowrap ${
    on ? 'border-0 bg-slate-100 text-slate-950 font-semibold' : 'border border-slate-800 bg-transparent text-slate-400 hover:text-slate-200'
  }`;
}

export default function StatusOverview({ doctors, visitMap, statusMap, profiles, myId, onOpenDoctor, onClose }: StatusOverviewProps) {
  const [period, setPeriod] = useState<Period>(7);
  const [events, setEvents] = useState<StatusEventRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [turno, setTurno] = useState<Shift | null>(null);
  /** grupos abertos/fechados; sem escolha, só o primeiro grupo fica aberto */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Recarrega ao trocar o período e quando um status novo chega pelo tempo real
  const liveStamp = useMemo(
    () =>
      Object.values(statusMap)
        .flat()
        .map((s) => s.created_at)
        .sort()
        .at(-1) ?? '',
    [statusMap],
  );
  useEffect(() => {
    let cancelled = false;
    void fetchStatusEventsSince(startOfPeriod(period).toISOString()).then((rows) => {
      if (cancelled) return;
      setFailed(rows === null);
      setEvents(rows ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [period, liveStamp]);

  /** Status atual de cada médico: a marca mais recente do período (ou um status que ainda vale) */
  const latest = useMemo(() => {
    const out = new Map<string, Mark>();
    const since = startOfPeriod(period).getTime();
    const consider = (docId: string, m: Mark) => {
      const cur = out.get(docId);
      if (!cur || new Date(m.at).getTime() > new Date(cur.at).getTime()) out.set(docId, m);
      else if (cur.type === m.type && Math.abs(new Date(m.at).getTime() - new Date(cur.at).getTime()) < 120_000 && m.active) {
        cur.active = true;
      }
    };
    for (const e of events ?? []) {
      if (!GROUP_TYPES.has(e.status_type) || !typeShown(e.status_type, period)) continue;
      consider(e.doctor_id, {
        type: e.status_type,
        at: e.event_at,
        repName: eventRepName(e, profiles),
        userId: e.created_by,
        returnDate: e.return_date ?? null,
        active: false,
      });
    }
    // Status ainda ativos (chegam em tempo real). Os do dia a dia só entram se marcados dentro do
    // período escolhido; Licença e Viagem ficam até o dia antes da volta (o app já tira depois disso).
    for (const [docId, list] of Object.entries(statusMap)) {
      for (const s of list) {
        if (!GROUP_TYPES.has(s.status_type) || !typeShown(s.status_type, period)) continue;
        const prolonged = s.status_type === 'ferias' || s.status_type === 'viajando';
        if (!prolonged && new Date(s.created_at).getTime() < since) continue;
        consider(docId, {
          type: s.status_type,
          at: s.created_at,
          repName: profiles[s.created_by]?.display_name?.trim() || s.rep_name?.trim() || 'Representante',
          userId: s.created_by,
          returnDate: s.return_date,
          active: true,
        });
      }
    }
    // Visitados (data e horário): a visita mais recente de qualquer representante dentro do período
    for (const [docId, list] of Object.entries(visitMap)) {
      for (const v of list) {
        if (new Date(v.visited_at).getTime() < since) continue;
        consider(docId, {
          type: 'visitado',
          at: v.visited_at,
          repName: profiles[v.user_id]?.display_name?.trim() || 'Representante',
          userId: v.user_id,
          returnDate: null,
          active: false,
        });
      }
    }
    return out;
  }, [events, statusMap, visitMap, profiles, period]);

  const byId = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const marked = useMemo(
    () => [...latest.keys()].map((id) => byId.get(id)).filter((d): d is Doctor => Boolean(d)),
    [latest, byId],
  );

  // Opções dos filtros saem só dos médicos marcados
  // Todas as cidades da base (não só as dos médicos marcados), com a grafia certa ("Parnaíba", não "parnaiba")
  const cities = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of doctors) if (d.cidade?.trim()) m.set(cityKey(d.cidade), prettyCity(d.cidade));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [doctors]);
  // Todas as especialidades cadastradas no sistema (lista oficial + as que existem nos médicos),
  // não só as dos médicos marcados no período
  const specialties = useMemo(
    () => {
      // sem repetir por maiúscula/minúscula; a grafia da lista oficial vale primeiro
      const m = new Map<string, string>();
      for (const e of ESPECIALIDADES) m.set(e.label.toLowerCase(), e.label);
      for (const d of doctors) {
        const s = d.especialidade?.trim();
        if (s && !m.has(s.toLowerCase()) && !specialtyCode(s)) m.set(s.toLowerCase(), s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
      }
      return [...m.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    },
    [doctors],
  );

  const visible = marked.filter((d) => {
    if (city && cityKey(d.cidade) !== city) return false;
    if (specialty) {
      const official = ESPECIALIDADES.find((e) => e.label === specialty);
      const same = official ? specialtyCode(d.especialidade) === official.code : d.especialidade?.trim() === specialty;
      if (!same) return false;
    }
    if (local && !matchesLocation(d, local)) return false;
    if (turno && !getAgenda(d).some((e) => shiftCovers(e.shift, turno))) return false;
    return true;
  });

  const groups = GROUPS.map((g) => ({
    ...g,
    docs: visible
      .filter((d) => latest.get(d.id)?.type === g.type)
      .sort((a, b) => new Date(latest.get(b.id)!.at).getTime() - new Date(latest.get(a.id)!.at).getTime()),
  })).filter((g) => g.docs.length > 0);

  const filterCount = (city ? 1 : 0) + (specialty ? 1 : 0) + (local ? 1 : 0) + (turno ? 1 : 0);

  return (
    <BottomSheet
      title="Status geral"
      onClose={onClose}
      footer={
        <>
          {filterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setCity(null);
                setSpecialty(null);
                setLocal(null);
                setTurno(null);
              }}
              className="h-12 shrink-0 rounded-xl border border-slate-700 bg-transparent px-4 text-sm font-medium text-slate-300 hover:text-red-400"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500"
          >
            Fechar
          </button>
        </>
      }
    >
      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)} className={chip(period === p.value)}>
              {p.label}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-slate-800" aria-hidden="true" />
          {FILTROS_TURNO.map((t) => (
            <button key={t.value} type="button" aria-pressed={turno === t.value} onClick={() => setTurno(turno === t.value ? null : t.value)} className={chip(turno === t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Local">
          {LOCAIS.map((l) => (
            <button key={l.value} type="button" aria-pressed={local === l.value} onClick={() => setLocal(local === l.value ? null : l.value)} className={chip(local === l.value)}>
              {l.label}
            </button>
          ))}
        </div>
        {cities.length > 0 && (
          <select
            aria-label="Cidade"
            value={city ?? ''}
            onChange={(e) => setCity(e.target.value || null)}
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-base sm:text-sm text-slate-200"
          >
            <option value="">Todas as cidades</option>
            {cities.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        )}
        {specialties.length > 0 && (
          <select
            aria-label="Especialidade"
            value={specialty ?? ''}
            onChange={(e) => setSpecialty(e.target.value || null)}
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-base sm:text-sm text-slate-200"
          >
            <option value="">Todas as especialidades</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Lista agrupada */}
      {events === null ? (
        <span className="text-sm text-slate-400">Carregando…</span>
      ) : groups.length === 0 ? (
        <span className="text-sm text-slate-400">
          {failed ? 'Não foi possível carregar o histórico. Mostrando só os status ativos.' : 'Nenhum médico marcado neste período.'}
        </span>
      ) : (
        groups.map((g, gi) => {
          const isOpen = openGroups[g.type] ?? gi === 0;
          return (
          <section key={g.type} className="flex flex-col gap-1.5">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenGroups((o) => ({ ...o, [g.type]: !isOpen }))}
              className="flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 px-3.5 text-left"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${g.dot}`} aria-hidden="true" />
              <span className="flex-1 text-sm font-semibold text-slate-100">{g.label}</span>
              <span className="grid h-[26px] min-w-[26px] place-items-center rounded-full bg-slate-800 px-2 text-[13px] font-bold text-slate-300">
                {g.docs.length}
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {isOpen && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {g.docs.map((d) => {
                const m = latest.get(d.id)!;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDoctor(d.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-left"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold uppercase text-slate-100">{d.descricao}</span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-400">
                          <RepAvatar name={m.repName} src={m.userId ? profiles[m.userId]?.avatar_url : null} me={m.userId === myId} size={18} />
                          <span className="truncate">
                            {shortName(m.repName)} {dayTime(m.at)}
                            {m.returnDate && ` · volta ${new Date(`${m.returnDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                          </span>
                        </span>
                        <span className="truncate text-[11px] uppercase text-slate-500">
                          {[d.complemento || 'Consultório próprio', prettyCity(d.cidade)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {m.active && (
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${m.type !== 'visitado' ? `${STATUS_META[m.type].border} ${STATUS_META[m.type].text}` : ''}`}>
                          Agora
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
          );
        })
      )}
    </BottomSheet>
  );
}
