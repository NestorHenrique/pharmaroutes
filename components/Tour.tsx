'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Dicas da tela inicial (primeiro acesso): 4 passos com a tela escurecida, um recorte iluminado e uma caixinha.
 *   1. topo: semana, ?, sino e perfil        (recorte nos botões reais do cabeçalho)
 *   2. dia, busca, filtros e +               (recorte no cabeçalho)
 *   3. o card: alça, horário médio, bandeira (cartão de EXEMPLO, nomes fictícios)
 *   4. as cores dos status                   (cartões de EXEMPLO)
 * Os elementos reais são achados por data-tour="..."; o que ainda não existe (? e sino) não é citado.
 */

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Step = {
  id: string;
  /** valores de data-tour que o recorte envolve (vazio = sem recorte, mostra exemplo no meio) */
  targets: string[];
  title: string;
  text: (present: string[]) => string;
  example?: 'card' | 'colors';
};

function listPt(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

const STEPS: Step[] = [
  {
    id: 'top',
    targets: ['week', 'help', 'bell', 'profile'],
    title: 'Aqui em cima',
    text: (present) => {
      const items = [
        present.includes('week') && 'a semana do ciclo (toque para trocar)',
        present.includes('help') && 'o ? com o guia de cores',
        present.includes('bell') && 'o sino com os avisos dos colegas',
        present.includes('profile') && 'o seu perfil',
      ].filter(Boolean) as string[];
      return `Você encontra ${listPt(items)}.`;
    },
  },
  {
    id: 'controls',
    targets: ['days', 'search', 'filters', 'add'],
    title: 'Encontre os médicos',
    text: (present) => {
      const items = [
        present.includes('days') && 'o dia da semana',
        present.includes('search') && 'a busca',
        present.includes('filters') && 'os filtros',
        present.includes('add') && 'o + para cadastrar um médico novo',
      ].filter(Boolean) as string[];
      return `Aqui ficam ${listPt(items)}.`;
    },
  },
  {
    id: 'card',
    targets: [],
    title: 'O card do médico',
    text: () => 'Cada médico aparece assim. Este é só um exemplo.',
    example: 'card',
  },
  {
    id: 'colors',
    targets: [],
    title: 'As cores',
    text: () => 'A etiqueta colorida mostra o que está acontecendo. Também são exemplos.',
    example: 'colors',
  },
];

/* ── Cartões de EXEMPLO (nomes fictícios) ── */

function ExampleCard({
  n,
  name,
  line,
  pill,
  pillCls,
  borderCls = 'border-slate-800',
  hour,
}: {
  n?: number;
  name: string;
  line: string;
  pill?: string;
  pillCls?: string;
  borderCls?: string;
  hour?: string;
}) {
  return (
    <div className={`relative flex items-center gap-3 rounded-2xl border bg-slate-900 px-3 py-2.5 ${borderCls}`}>
      <span className="absolute -top-2 right-3 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-slate-950">
        EXEMPLO
      </span>
      {n !== undefined && (
        <span className="-ml-1 flex h-11 w-[30px] shrink-0 flex-col items-center justify-center gap-[3px] rounded-lg bg-slate-800 text-slate-400" aria-hidden="true">
          <span className="text-xs font-bold leading-none">{n}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.8" /><circle cx="15" cy="6" r="1.8" /><circle cx="9" cy="12" r="1.8" /><circle cx="15" cy="12" r="1.8" /><circle cx="9" cy="18" r="1.8" /><circle cx="15" cy="18" r="1.8" />
          </svg>
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {pill && <span className={`self-start rounded-md px-2 py-0.5 text-[11px] font-bold ${pillCls}`}>{pill}</span>}
        <span className="truncate text-[15px] font-semibold uppercase text-white">{name}</span>
        <span className="truncate text-xs uppercase text-slate-400">{line}</span>
      </span>
      {hour && (
        <span className="flex shrink-0 items-center gap-1 text-base font-semibold tabular-nums text-slate-100">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {hour}
        </span>
      )}
    </div>
  );
}

function CardExample() {
  return (
    <div className="flex flex-col gap-3">
      <ExampleCard
        n={3}
        name="Dra. Ana Exemplo"
        line="CAR · Clínica Modelo · Parnaíba"
        pill="Aguardando médico"
        pillCls="bg-amber-400 text-slate-950"
        borderCls="border-amber-400/60"
        hour="09:40"
      />
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-slate-300">
        <li><strong className="text-slate-100">Alça com número</strong> (à esquerda): a posição na rota. Segure e arraste para mudar a ordem.</li>
        <li><strong className="text-slate-100">Horário médio</strong> (à direita): quando os colegas costumam chegar nesse médico.</li>
        <li><strong className="text-slate-100">Bandeira</strong> (a etiqueta colorida): o status que alguém marcou.</li>
      </ul>
    </div>
  );
}

function ColorsExample() {
  return (
    <div className="flex flex-col gap-2.5">
      <ExampleCard name="Dr. Carlos Modelo" line="Avisa os colegas da cidade" pill="Último paciente" pillCls="bg-red-500 text-slate-950" borderCls="border-red-500/60" />
      <ExampleCard name="Dra. Bia Fictícia" line="Você ou um colega está lá" pill="Rep. no consultório" pillCls="bg-sky-500 text-slate-950" borderCls="border-sky-500/60" />
      <ExampleCard name="Dr. Davi Teste" line="Esperando ser atendido" pill="Aguardando médico" pillCls="bg-amber-400 text-slate-950" borderCls="border-amber-400/60" />
      <ExampleCard name="Dra. Eva Amostra" line="Visita feita no ciclo" pill="Já visitei" pillCls="bg-emerald-500 text-slate-950" borderCls="border-emerald-500/60" />
    </div>
  );
}

/* ── Tour ── */

const PAD = 6;

function measure(targets: string[]): { rect: Rect | null; present: string[] } {
  const present: string[] = [];
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const t of targets) {
    const els = document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`);
    let found = false;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      found = true;
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    if (found) present.push(t);
  }
  if (present.length === 0) return { rect: null, present };
  return {
    rect: {
      top: Math.max(4, top - PAD),
      left: Math.max(4, left - PAD),
      width: Math.min(window.innerWidth - 8, right - left + PAD * 2),
      height: bottom - top + PAD * 2,
    },
    present,
  };
}

interface TourProps {
  /** tocou em "Começar a usar" no último passo */
  onFinish: () => void;
  /** tocou em "Pular" (ou Esc) */
  onSkip: () => void;
}

export default function Tour({ onFinish, onSkip }: TourProps) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [present, setPresent] = useState<string[]>([]);
  const nextRef = useRef<HTMLButtonElement | null>(null);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const update = useCallback(() => {
    if (step.targets.length === 0) {
      setRect(null);
      setPresent([]);
      return;
    }
    const m = measure(step.targets);
    setRect(m.rect);
    setPresent(m.present);
  }, [step]);

  // A página fica parada no topo durante as dicas (o cabeçalho é fixo, o recorte acompanha)
  useEffect(() => {
    window.scrollTo(0, 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSkip]);

  if (typeof document === 'undefined') return null;

  const spot = step.targets.length > 0 && rect;
  // Caixinha embaixo do recorte; se não couber, em cima
  const below = spot ? rect.top + rect.height + 12 : 0;
  const placeBelow = spot ? below + 230 < window.innerHeight : true;
  const boxStyle: React.CSSProperties = spot
    ? placeBelow
      ? { top: below, transform: 'translateX(-50%)' }
      : { bottom: window.innerHeight - rect.top + 12, transform: 'translateX(-50%)' }
    : { top: '50%', transform: 'translate(-50%, -50%)' };

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Dicas de uso">
      {/* bloqueia toques na tela por trás; o recorte (ou o escurecido) é só visual */}
      <div className="absolute inset-0" style={spot ? undefined : { background: 'rgba(0,0,0,.78)' }} />
      {spot && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl border-2 border-blue-400 transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 100vmax rgba(0,0,0,.78)',
          }}
        />
      )}

      <div
        className="absolute left-1/2 flex w-[min(92vw,380px)] flex-col gap-3 rounded-3xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/60"
        style={{ ...boxStyle, maxHeight: '86dvh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
            <h2 className="m-0 text-[15px] font-bold uppercase tracking-[0.1em] text-blue-400">{step.title}</h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {i + 1} de {STEPS.length}
          </span>
        </div>

        <p className="m-0 text-sm leading-snug text-slate-300">{step.text(present)}</p>

        {step.example === 'card' && <CardExample />}
        {step.example === 'colors' && <ColorsExample />}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="h-11 shrink-0 rounded-xl border-0 bg-transparent px-3 text-sm font-medium text-slate-400 hover:text-slate-100"
          >
            Pular
          </button>
          <button
            ref={nextRef}
            type="button"
            onClick={() => (last ? onFinish() : setI((n) => n + 1))}
            className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500"
          >
            {last ? 'Começar a usar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

