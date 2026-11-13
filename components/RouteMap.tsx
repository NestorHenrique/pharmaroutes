'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import dynamic from 'next/dynamic';

export interface MapStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: 'next' | 'todo' | 'done';
  /** posição na rota (só para quem ainda falta) */
  n?: number;
}

const TILE = 256;
const H = 420;

/** Posição em pixels no mapa-múndi (projeção dos mapas de rua) no zoom z */
function project(lat: number, lng: number, z: number) {
  const scale = TILE * 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale,
  };
}

/**
 * Mapa da rota do dia, sem biblioteca: imagens de rua do OpenStreetMap + pinos numerados por cima.
 * Verde = visitado, violeta cheio = próximo, contorno = falta. Tocar no pino abre a ficha.
 */
const RouteMapGL = dynamic(() => import('@/components/RouteMapGL'), { ssr: false });

/** Com a chave do MapTiler usa o mapa vetorial (RouteMapGL); sem ela, o mapa simples abaixo. */
export default function RouteMap(props: { stops: MapStop[]; onOpen: (id: string) => void }) {
  // Se o mapa vetorial não iniciar (WebGL indisponível, estilo bloqueado...), cai no mapa simples e mostra o motivo
  const [glFail, setGlFail] = useState<string | null>(null);
  if (process.env.NEXT_PUBLIC_MAPTILER_KEY && props.stops.length > 0 && !glFail) return <RouteMapGL {...props} onFail={setGlFail} />;
  return (
    <>
      {glFail && (
        <p className="mb-2 text-[12px] text-slate-400">
          Mapa detalhado indisponível neste aparelho ({glFail}). Mostrando o mapa simples.
        </p>
      )}
      <RouteMapRaster {...props} />
    </>
  );
}

function RouteMapRaster({ stops, onOpen }: { stops: MapStop[]; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(358);
  const [dz, setDz] = useState(0);
  /** centro arrastado pelo usuário (0..1 no mapa-múndi); null = centro da rota */
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const dragged = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 358);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (stops.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-700 bg-slate-900 px-5 py-10 text-center">
        <p className="m-0 text-base font-semibold text-slate-50">Nenhum médico de hoje tem GPS</p>
        <p className="m-0 max-w-xs text-[13px] leading-snug text-slate-400">Abra a ficha do médico, toque em Editar e grave o GPS quando estiver no consultório. Ele passa a aparecer aqui.</p>
      </div>
    );
  }

  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const box = { n: Math.max(...lats), s: Math.min(...lats), e: Math.max(...lngs), w: Math.min(...lngs) };
  let fit = 16;
  for (let z = 17; z >= 3; z--) {
    const a = project(box.n, box.w, z);
    const b = project(box.s, box.e, z);
    fit = z;
    if (b.x - a.x <= w - 96 && b.y - a.y <= H - 96) break;
  }
  const z = Math.max(3, Math.min(18, fit + dz));
  const a = project(box.n, box.w, z);
  const b = project(box.s, box.e, z);
  const scale = TILE * 2 ** z;
  const cx = center?.x ?? (a.x + b.x) / 2 / scale;
  const cy = center?.y ?? (a.y + b.y) / 2 / scale;
  const origin = { x: cx * scale - w / 2, y: cy * scale - H / 2 };
  const max = 2 ** z;
  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  for (let tx = Math.floor(origin.x / TILE); tx <= Math.floor((origin.x + w) / TILE); tx++) {
    for (let ty = Math.floor(origin.y / TILE); ty <= Math.floor((origin.y + H) / TILE); ty++) {
      if (ty < 0 || ty >= max) continue;
      const wx = ((tx % max) + max) % max;
      tiles.push({ key: `${z}-${tx}-${ty}`, src: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`, left: tx * TILE - origin.x, top: ty * TILE - origin.y });
    }
  }
  const pts = stops.map((s) => {
    const p = project(s.lat, s.lng, z);
    return { ...s, x: p.x - origin.x, y: p.y - origin.y };
  });
  const zoomBtn = 'flex size-11 items-center justify-center border-0 bg-slate-900 text-xl font-bold text-slate-100 disabled:opacity-40';

  const zoomBy = (delta: number) => setDz((d) => Math.max(3, Math.min(18, fit + d + delta)) - fit);

  /* Um dedo arrasta o mapa; dois dedos fazem pinça (aproxima/afasta). O toque curto continua abrindo o pino. */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start.current = { x: e.clientX, y: e.clientY };
    dragged.current = false;
    if (fingers.current.size === 2) {
      const [p1, p2] = [...fingers.current.values()];
      pinch.current = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = fingers.current.get(e.pointerId);
    if (!prev) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size >= 2 && pinch.current) {
      const [p1, p2] = [...fingers.current.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      dragged.current = true;
      if (dist / pinch.current > 1.4) {
        zoomBy(1);
        pinch.current = dist;
      } else if (dist / pinch.current < 0.71) {
        zoomBy(-1);
        pinch.current = dist;
      }
      return;
    }
    if (!dragged.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) < 6) return;
    if (!dragged.current) e.currentTarget.setPointerCapture(e.pointerId);
    dragged.current = true;
    const nx = cx - (e.clientX - prev.x) / scale;
    const ny = cy - (e.clientY - prev.y) / scale;
    setCenter({ x: nx, y: Math.max(0, Math.min(1, ny)) });
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    fingers.current.delete(e.pointerId);
    if (fingers.current.size < 2) pinch.current = null;
  };
  const moved = center !== null || dz !== 0;

  return (
    <div
      ref={ref}
      className="relative -mx-4 overflow-hidden bg-slate-800 sm:mx-0 sm:rounded-3xl"
      style={{ height: H, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        // Depois de arrastar, o dedo ao soltar não pode abrir a ficha do pino que estava embaixo
        if (dragged.current) {
          e.stopPropagation();
          e.preventDefault();
          dragged.current = false;
        }
      }}
    >
      <div className="map-tiles absolute inset-0" aria-hidden="true">
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.key} src={t.src} alt="" width={TILE} height={TILE} draggable={false} className="absolute max-w-none select-none" style={{ left: t.left, top: t.top }} />
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-0" width={w} height={H} aria-hidden="true">
        <polyline points={pts.filter((p) => p.state !== 'done').map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 9" />
      </svg>
      {pts.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(p.id)}
          aria-label={`${p.name}${p.state === 'done' ? ', visitado' : p.state === 'next' ? ', próximo' : ''}. Abrir ficha`}
          className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0"
          style={{ left: p.x, top: p.y, zIndex: p.state === 'next' ? 3 : p.state === 'todo' ? 2 : 1 }}
        >
          <span
            className={`grid place-items-center rounded-full text-[13px] font-bold shadow-lg shadow-black/40 ${
              p.state === 'done'
                ? 'size-7 bg-emerald-500 text-slate-950'
                : p.state === 'next'
                  ? 'size-10 border-[3px] border-slate-950 bg-blue-600 text-white'
                  : 'size-8 border-2 border-blue-600 bg-slate-900 text-slate-100'
            }`}
          >
            {p.state === 'done' ? '✓' : p.n}
          </span>
        </button>
      ))}
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-slate-700 shadow-lg shadow-black/40">
        <button type="button" aria-label="Aproximar" onClick={() => zoomBy(1)} disabled={z >= 18} className={zoomBtn}>
          +
        </button>
        <button type="button" aria-label="Afastar" onClick={() => zoomBy(-1)} disabled={z <= 3} className={`${zoomBtn} border-t border-slate-700`}>
          −
        </button>
      </div>
      {moved && (
        <button
          type="button"
          onClick={() => {
            setCenter(null);
            setDz(0);
          }}
          className="absolute bottom-3 left-3 h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 text-[13px] font-semibold text-slate-100 shadow-lg shadow-black/40"
        >
          Centralizar rota
        </button>
      )}
      <span className="absolute bottom-1 right-2 rounded bg-slate-950/70 px-1.5 text-[10px] text-slate-300">© OpenStreetMap</span>
    </div>
  );
}
