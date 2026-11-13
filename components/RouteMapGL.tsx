'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapStop } from '@/components/RouteMap';

const KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';
const H = 420;

function styleUrl(): string {
  const light = document.documentElement.getAttribute('data-theme') === 'marfim';
  return `https://api.maptiler.com/maps/${light ? 'streets-v2' : 'streets-v2-dark'}/style.json?key=${KEY}`;
}

/** Pino numerado: mesmo visual do mapa antigo (verde = visitado, violeta cheio = próximo, contorno = falta) */
function pinEl(s: MapStop, onOpen: (id: string) => void): HTMLElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', `${s.name}${s.state === 'done' ? ', visitado' : s.state === 'next' ? ', próximo' : ''}. Abrir ficha`);
  btn.className = 'flex size-11 items-center justify-center border-0 bg-transparent p-0';
  const dot = document.createElement('span');
  dot.className =
    'grid place-items-center rounded-full text-[13px] font-bold shadow-lg shadow-black/40 ' +
    (s.state === 'done'
      ? 'size-7 bg-emerald-500 text-slate-950'
      : s.state === 'next'
        ? 'size-10 border-[3px] border-slate-950 bg-blue-600 text-white'
        : 'size-8 border-2 border-blue-600 bg-slate-900 text-slate-100');
  dot.textContent = s.state === 'done' ? '✓' : String(s.n ?? '');
  btn.appendChild(dot);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onOpen(s.id);
  });
  return btn;
}

/**
 * Mapa da rota com mapa vetorial (MapLibre + MapTiler): arrasta, pinça e gira com os dedos, texto nítido em qualquer zoom.
 * Só é usado quando existe NEXT_PUBLIC_MAPTILER_KEY; sem a chave o app mostra o mapa simples.
 */
export default function RouteMapGL({ stops, onOpen }: { stops: MapStop[]; onOpen: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const [moved, setMoved] = useState(false);
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  const fit = (animate: boolean) => {
    const map = mapRef.current;
    const list = stopsRef.current;
    if (!map || list.length === 0) return;
    const b = new maplibregl.LngLatBounds();
    for (const s of list) b.extend([s.lng, s.lat]);
    map.fitBounds(b, { padding: 56, maxZoom: 16, duration: animate ? 400 : 0 });
  };

  // Cria o mapa uma vez
  useEffect(() => {
    if (!box.current) return;
    const map = new maplibregl.Map({
      container: box.current,
      style: styleUrl(),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('dragstart', () => setMoved(true));
    map.on('zoomstart', (e) => {
      if ((e as unknown as { originalEvent?: unknown }).originalEvent) setMoved(true);
    });
    mapRef.current = map;
    fit(false);
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tema claro/escuro: troca o estilo do mapa
  useEffect(() => {
    const ro = new MutationObserver(() => mapRef.current?.setStyle(styleUrl()));
    ro.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => ro.disconnect();
  }, []);

  // Pinos e linha da rota acompanham a lista
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    markers.current = stops.map((s) =>
      new maplibregl.Marker({ element: pinEl(s, (id) => onOpenRef.current(id)) }).setLngLat([s.lng, s.lat]).addTo(map),
    );
    const draw = () => {
      const coords = stops.filter((s) => s.state !== 'done').map((s) => [s.lng, s.lat]);
      const data = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } as const;
      const src = map.getSource('rota') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
        return;
      }
      map.addSource('rota', { type: 'geojson', data });
      map.addLayer({
        id: 'rota-linha',
        type: 'line',
        source: 'rota',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#A78BFA', 'line-width': 4, 'line-dasharray': [0.5, 2.2] },
      });
    };
    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
    map.on('styledata', () => {
      if (map.isStyleLoaded() && !map.getSource('rota')) draw();
    });
    fit(false);
    setMoved(false);
  }, [stops]);

  return (
    <div className="relative -mx-4 overflow-hidden bg-slate-800 sm:mx-0 sm:rounded-3xl" style={{ height: H }}>
      <div ref={box} className="absolute inset-0" style={{ touchAction: 'none' }} />
      {moved && (
        <button
          type="button"
          onClick={() => {
            fit(true);
            setMoved(false);
          }}
          className="absolute bottom-8 left-3 h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 text-[13px] font-semibold text-slate-100 shadow-lg shadow-black/40"
        >
          Centralizar rota
        </button>
      )}
    </div>
  );
}
