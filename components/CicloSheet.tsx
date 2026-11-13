'use client';

import { useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { Doctor } from '@/types/doctor';
import { CYCLE_WEEKS } from '@/types/doctor';
import { cityKey, getAgenda, prettyCity, specialtyCode } from '@/utils';

interface CicloSheetProps {
  doctors: Doctor[];
  /** semanas do ciclo de cada médico (vêm de rep_route_order, por representante) */
  weeksByDoctor: ReadonlyMap<string, readonly number[]>;
  /** ordem da rota de uma semana (ids dos médicos) */
  orderOf: (week: number) => readonly string[];
  /** nova ordem (ids na ordem da tela) da semana; quem estava fora da semana entra nela */
  onReorder: (week: number, ids: string[]) => void;
  /** cidades (cityKey) em que o rep trabalha em cada semana */
  citiesOf: (week: number) => readonly string[];
  onSaveCities: (week: number, keys: string[]) => void;
  onMoveWeek: (docId: string, from: number, to: number) => void;
  /** o médico entra na rota deste dia? (agenda + trocas do representante) */
  onDay: (doc: Doctor, day: string) => boolean;
  /** troca o dia do médico só para este representante */
  onMoveDay: (docId: string, from: string, to: string) => void;
  onRemoveWeek: (docId: string, from: number) => void;
  onClose: () => void;
  onOpen: (id: string) => void;
}

const DAYS = [
  { code: 'seg', label: 'Seg' },
  { code: 'ter', label: 'Ter' },
  { code: 'qua', label: 'Qua' },
  { code: 'qui', label: 'Qui' },
  { code: 'sex', label: 'Sex' },
] as const;

type DayCode = (typeof DAYS)[number]['code'];

const GAP = 8;

/** Todos os médicos que atendem no dia (em qualquer local), qualquer que seja o status ou a semana do ciclo.
 *  Os da semana escolhida vêm primeiro, na ordem da rota; os outros vêm depois. */
function getDoctorsForDay(
  doctors: Doctor[],
  weeksByDoctor: ReadonlyMap<string, readonly number[]>,
  week: number,
  day: DayCode,
  order: readonly string[] = [],
  onDay?: (doc: Doctor, day: string) => boolean,
): Doctor[] {
  const pos = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const inWeek = (d: Doctor) => (weeksByDoctor.get(d.id) ?? []).includes(week);
  return doctors
    .filter((d) => {
      if (onDay) return onDay(d, day);
      if (getAgenda(d).some((e) => e.day === day)) return true;
      return (d.locais ?? []).some((l) => l.agenda.some((e) => e.day === day));
    })
    .sort((a, b) => Number(inWeek(b)) - Number(inWeek(a)) || pos(a.id) - pos(b.id));
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/** Tela de organização do ciclo: semana × dia → lista ordenada de médicos (arrastar pela alça). */
export default function CicloSheet({
  doctors,
  weeksByDoctor,
  orderOf,
  onReorder,
  citiesOf,
  onSaveCities,
  onMoveWeek,
  onRemoveWeek,
  onDay,
  onMoveDay,
  onClose,
  onOpen,
}: CicloSheetProps) {
  const [week, setWeek] = useState<number>(1);
  const [day, setDay] = useState<DayCode>('seg');
  const [moving, setMoving] = useState<Doctor | null>(null);
  const inWeek = (d: Doctor) => (weeksByDoctor.get(d.id) ?? []).includes(week);

  /* ── Cidades da semana: o rep marca onde trabalha; só os médicos dessas cidades entram ── */
  const picked = new Set(citiesOf(week));
  const inCities = (d: Doctor) => picked.size === 0 || picked.has(cityKey(d.cidade));
  const cityOptions = (() => {
    const count = new Map<string, { label: string; n: number }>();
    for (const d of doctors) {
      const k = cityKey(d.cidade);
      if (!k) continue;
      const cur = count.get(k) ?? { label: prettyCity(d.cidade), n: 0 };
      cur.n += 1;
      count.set(k, cur);
    }
    return [...count.entries()]
      .sort((a, b) => Number(picked.has(b[0])) - Number(picked.has(a[0])) || b[1].n - a[1].n)
      .map(([key, v]) => ({ key, ...v }));
  })();
  const toggleCity = (k: string) => {
    const next = picked.has(k) ? [...picked].filter((x) => x !== k) : [...picked, k];
    onSaveCities(week, next);
  };

  const dayDocs = (d: DayCode, order: readonly string[] = []) =>
    getDoctorsForDay(doctors, weeksByDoctor, week, d, order, onDay).filter(inCities);
  const list = dayDocs(day, orderOf(week));
  const weekCount = list.filter(inWeek).length;
  const dayCounts = DAYS.map((d) => dayDocs(d.code).length);

  /* ── Arrastar pela alça: a linha segue o dedo e as outras abrem espaço ── */
  const rows = useRef(new Map<string, HTMLDivElement>());
  const [drag, setDrag] = useState<{ id: string; from: number; to: number; dy: number } | null>(null);
  const info = useRef<{
    id: string;
    from: number;
    to: number;
    startY: number;
    startScroll: number;
    scroller: HTMLElement | null;
    mids: number[];
    h: number;
    raf: number;
    lastY: number;
  } | null>(null);

  const targetIndex = (from: number, dy: number) => {
    const d = info.current;
    if (!d) return from;
    const center = d.mids[from] + dy;
    let to = 0;
    d.mids.forEach((m, i) => {
      if (i !== from && m < center) to += 1;
    });
    return to;
  };

  const updateDrag = (clientY: number) => {
    const d = info.current;
    if (!d) return;
    d.lastY = clientY;
    const dy = clientY - d.startY + ((d.scroller?.scrollTop ?? 0) - d.startScroll);
    d.to = targetIndex(d.from, dy);
    setDrag({ id: d.id, from: d.from, to: d.to, dy });
  };

  const startDrag = (e: React.PointerEvent<HTMLElement>, id: string, from: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const el = rows.current.get(id) ?? null;
    const scroller = scrollParent(el);
    const mids = list.map((doc) => {
      const r = rows.current.get(doc.id)?.getBoundingClientRect();
      return r ? r.top + r.height / 2 : 0;
    });
    info.current = {
      id,
      from,
      to: from,
      startY: e.clientY,
      startScroll: scroller?.scrollTop ?? 0,
      scroller,
      mids,
      h: el?.getBoundingClientRect().height ?? 60,
      raf: 0,
      lastY: e.clientY,
    };
    // perto da borda da folha, a lista rola sozinha
    const tick = () => {
      const d = info.current;
      if (!d) return;
      const box = d.scroller?.getBoundingClientRect();
      if (d.scroller && box) {
        const edge = 70;
        let v = 0;
        if (d.lastY < box.top + edge) v = -Math.ceil((box.top + edge - d.lastY) / 6);
        else if (d.lastY > box.bottom - edge) v = Math.ceil((d.lastY - (box.bottom - edge)) / 6);
        if (v) {
          d.scroller.scrollTop += v;
          updateDrag(d.lastY);
        }
      }
      d.raf = requestAnimationFrame(tick);
    };
    info.current.raf = requestAnimationFrame(tick);
    setDrag({ id, from, to: from, dy: 0 });
  };

  const endDrag = (e?: React.PointerEvent<HTMLElement>) => {
    const d = info.current;
    if (!d) return;
    if (e) updateDrag(e.clientY);
    cancelAnimationFrame(d.raf);
    info.current = null;
    if (d.to !== d.from) {
      const ids = list.map((x) => x.id);
      const [moved] = ids.splice(d.from, 1);
      ids.splice(d.to, 0, moved);
      onReorder(week, ids);
    }
    setDrag(null);
  };

  /** Teclado: setas para cima/baixo na alça mudam a posição */
  const keyMove = (e: React.KeyboardEvent, from: number) => {
    const to = e.key === 'ArrowUp' ? from - 1 : e.key === 'ArrowDown' ? from + 1 : -1;
    if (to < 0 || to >= list.length) return;
    e.preventDefault();
    const ids = list.map((d) => d.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(week, ids);
  };

  const shiftOf = (i: number): number => {
    if (!drag || i === drag.from) return 0;
    const h = (info.current?.h ?? 60) + GAP;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -h;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return h;
    return 0;
  };

  return (
    <>
      <BottomSheet title="Organizar rota do ciclo" onClose={onClose}>
        {/* semanas */}
        <div className="-mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 no-scrollbar pb-1">
          {CYCLE_WEEKS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeek(w)}
              aria-pressed={week === w}
              className={`flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-semibold ${
                week === w ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {w}ª semana
            </button>
          ))}
        </div>

        {/* cidades da semana */}
        <div className="flex shrink-0 flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Cidades da {week}ª semana{picked.size > 0 ? ` · ${picked.size}` : ''}
          </span>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
            {cityOptions.map((c) => {
              const on = picked.has(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => toggleCity(c.key)}
                  aria-pressed={on}
                  className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold ${
                    on ? 'border-blue-600 bg-blue-900 text-blue-200' : 'border-slate-700 bg-slate-800 text-slate-400'
                  }`}
                >
                  {on && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                  {c.label}
                </button>
              );
            })}
          </div>
          {picked.size === 0 && (
            <span className="text-xs text-slate-500">
              Marque as cidades em que você trabalha nesta semana. Sem cidade marcada, aparecem todas.
            </span>
          )}
        </div>

        {/* dias da semana */}
        <div className="grid shrink-0 grid-cols-5 gap-1.5">
          {DAYS.map((d, i) => (
            <button
              key={d.code}
              type="button"
              onClick={() => setDay(d.code)}
              aria-pressed={day === d.code}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-[14px] py-2.5 text-[13px] font-bold ${
                day === d.code ? 'bg-blue-600 text-white' : 'border border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {d.label}
              <span className={`text-[11px] font-semibold ${day === d.code ? 'opacity-80' : 'text-slate-500'}`}>
                {dayCounts[i]}
              </span>
            </button>
          ))}
        </div>

        {/* lista de médicos do dia */}
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M8 2v4M16 2v4" />
            </svg>
            <p className="text-[13px] text-slate-500">
              Nenhum médico atende neste dia{picked.size > 0 ? ' nas cidades marcadas' : ''}.
              <br />
              {picked.size > 0 ? 'Marque outra cidade ou edite a agenda do médico.' : 'Edite a agenda do médico para adicioná-lo.'}
            </p>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                {DAYS.find((d) => d.code === day)?.label} · {list.length} {list.length === 1 ? 'médico' : 'médicos'} · {weekCount} na {week}ª
              </span>
              <span className="text-right text-[11px] text-slate-500">Arraste pela alça para ordenar</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((doc, i) => {
                const dragging = drag?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    ref={(el) => {
                      if (el) rows.current.set(doc.id, el);
                      else rows.current.delete(doc.id);
                    }}
                    style={{
                      transform: `translateY(${dragging ? drag.dy : shiftOf(i)}px)`,
                      transition: drag && !dragging ? 'transform 150ms ease' : 'none',
                    }}
                    className={`relative flex min-h-[60px] items-center gap-1.5 rounded-2xl border bg-slate-900 py-1.5 pl-1 pr-2 ${
                      dragging ? 'z-10 border-blue-600 shadow-xl shadow-black/50' : 'border-slate-800'
                    } ${inWeek(doc) || dragging ? '' : 'opacity-75'}`}
                  >
                    <button
                      type="button"
                      aria-label={`${doc.descricao}, posição ${i + 1}. Arraste ou use as setas para mudar a ordem`}
                      onPointerDown={(e) => startDrag(e, doc.id, i)}
                      onPointerMove={(e) => {
                        if (info.current?.id === doc.id) updateDrag(e.clientY);
                      }}
                      onPointerUp={endDrag}
                      onPointerCancel={() => endDrag()}
                      onKeyDown={(e) => keyMove(e, i)}
                      style={{ touchAction: 'none' }}
                      className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center border-0 bg-transparent p-0 text-slate-500 active:cursor-grabbing"
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
                        <circle cx="2" cy="2" r="1.6" />
                        <circle cx="8" cy="2" r="1.6" />
                        <circle cx="2" cy="8" r="1.6" />
                        <circle cx="8" cy="8" r="1.6" />
                        <circle cx="2" cy="14" r="1.6" />
                        <circle cx="8" cy="14" r="1.6" />
                      </svg>
                    </button>
                    <span className="font-display grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-slate-700 text-[13px] font-bold tabular-nums text-slate-100">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpen(doc.id);
                      }}
                      className="ml-1 flex min-h-11 min-w-0 flex-1 flex-col items-start gap-0.5 border-0 bg-transparent p-0 text-left"
                    >
                      <span className="w-full truncate text-sm font-bold uppercase text-white">{doc.descricao}</span>
                      <span className="w-full truncate text-xs uppercase text-slate-400">
                        {[specialtyCode(doc.especialidade), doc.complemento, doc.cidade].filter(Boolean).join(' · ')}
                      </span>
                      {!inWeek(doc) && (
                        <span className="text-[11px] font-semibold text-slate-500">Fora da {week}ª semana · entra ao ordenar</span>
                      )}
                    </button>
                    {inWeek(doc) && (
                      <button
                        type="button"
                        aria-label="Mover para outro dia ou semana"
                        onClick={() => setMoving(doc)}
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl border-0 bg-slate-800 text-base text-slate-100"
                      >
                        ⇄
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </BottomSheet>

      {moving && (
        <BottomSheet title="Mover médico" onClose={() => setMoving(null)}>
          <span className="-mt-2 truncate text-[13px] uppercase text-slate-400">{moving.descricao}</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Outro dia da semana</span>
          <div className="grid grid-cols-5 gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d.code}
                type="button"
                disabled={d.code === day}
                onClick={() => {
                  onMoveDay(moving.id, day, d.code);
                  setDay(d.code);
                  setMoving(null);
                }}
                className="h-14 rounded-[14px] border border-slate-800 bg-slate-900 text-[13px] font-bold text-slate-100 disabled:opacity-35"
              >
                {d.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Outra semana do ciclo</span>
          <div className="grid grid-cols-5 gap-1.5">
            {CYCLE_WEEKS.map((w) => (
              <button
                key={w}
                type="button"
                disabled={w === week}
                onClick={() => {
                  onMoveWeek(moving.id, week, w);
                  setMoving(null);
                }}
                className="h-14 rounded-[14px] border border-slate-800 bg-slate-900 text-[13px] font-bold text-slate-100 disabled:opacity-35"
              >
                {w}ª
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onRemoveWeek(moving.id, week);
              setMoving(null);
            }}
            className="h-11 self-start border-0 bg-transparent px-1 text-sm font-semibold text-red-500"
          >
            Tirar desta semana
          </button>
          <span className="text-xs text-slate-500">Trocar o dia vale só para você: a agenda do médico não muda para os colegas.</span>
        </BottomSheet>
      )}
    </>
  );
}
