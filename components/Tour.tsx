'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  /** lista numerada (cada item aponta para um elemento do recorte e ganha o mesmo número ali) */
  items?: { target: string; node: ReactNode }[];
  example?: 'card' | 'colors';
};

const STEPS: Step[] = [
  {
    id: 'top',
    targets: ['week', 'help', 'bell', 'profile'],
    title: 'O topo da sua tela',
    text: () => '',
    items: [
      { target: 'week', node: <>Toque para <b>trocar de semana</b>.</> },
      { target: 'help', node: <>O <b>?</b> explica as cores e os status.</> },
      { target: 'bell', node: <>O sino mostra os <b>avisos</b> dos colegas.</> },
      { target: 'profile', node: <>Seu <b>perfil</b>, cidades e ciclo.</> },
    ],
  },
  {
    id: 'controls',
    targets: ['days', 'search', 'filters', 'add'],
    title: 'Dia, busca e filtros',
    text: () => '',
    items: [
      { target: 'days', node: <>Escolha o <b>dia da semana</b>.</> },
      { target: 'search', node: <><b>Busque</b> por nome, especialidade ou CRM.</> },
      { target: 'filters', node: <><b>Filtros</b>: cidade, turno e mais.</> },
      { target: 'add', node: <><b>+</b> cadastra um médico novo.</> },
    ],
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
        <li><strong className="text-slate-100">Número</strong> (à esquerda): a posição na rota.</li>
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

function measure(targets: string[]): { rect: Rect | null; present: string[]; each: Record<string, Rect> } {
  const present: string[] = [];
  const each: Record<string, Rect> = {};
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
      const prev = each[t];
      each[t] = prev
        ? { top: Math.min(prev.top, r.top), left: Math.min(prev.left, r.left), width: Math.max(prev.left + prev.width, r.right) - Math.min(prev.left, r.left), height: Math.max(prev.top + prev.height, r.bottom) - Math.min(prev.top, r.top) }
        : { top: r.top, left: r.left, width: r.width, height: r.height };
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    if (found) present.push(t);
  }
  if (present.length === 0) return { rect: null, present, each };
  return {
    rect: {
      top: Math.max(4, top - PAD),
      left: Math.max(4, left - PAD),
      width: Math.min(window.innerWidth - 8, right - left + PAD * 2),
      height: bottom - top + PAD * 2,
    },
    present,
    each,
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
  const [each, setEach] = useState<Record<string, Rect>>({});
  const nextRef = useRef<HTMLButtonElement | null>(null);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const update = useCallback(() => {
    if (step.targets.length === 0) {
      setRect(null);
      setPresent([]);
      setEach({});
      return;
    }
    const m = measure(step.targets);
    setRect(m.rect);
    setPresent(m.present);
    setEach(m.each);
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
  const shown = (step.items ?? []).filter((it) => present.includes(it.target));
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
          className="pointer-events-none absolute rounded-2xl border-2 border-violet-400 transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 100vmax rgba(0,0,0,.78)',
          }}
        />
      )}

      {spot &&
        shown.map((it, n) => {
          const r = each[it.target];
          return (
            <span
              key={it.target}
              aria-hidden="true"
              className="pointer-events-none absolute grid size-6 place-items-center rounded-full bg-violet-400 text-xs font-bold text-[#0B0B12] shadow-[0_0_0_2px_#0B0B12]"
              style={{ top: Math.max(2, r.top - 11), left: Math.min(window.innerWidth - 26, Math.max(2, r.left + r.width / 2 - 12)) }}
            >
              {n + 1}
            </span>
          );
        })}

      <div
        className="absolute left-1/2 flex w-[min(92vw,380px)] flex-col gap-3 rounded-[18px] bg-[#F4F2EE] p-4 text-[#17171A] shadow-2xl shadow-black/60"
        style={{ ...boxStyle, maxHeight: '86dvh', overflowY: 'auto' }}
      >
        <div className="flex items-center gap-1.5" role="img" aria-label={`${i + 1} de ${STEPS.length}`}>
          {STEPS.map((s, n) => (
            <span key={s.id} className={`h-1 w-[18px] rounded-full ${n <= i ? 'bg-[#5B3FD0]' : 'bg-[#CFCBE0]'}`} aria-hidden="true" />
          ))}
          <span className="ml-1.5 text-xs text-[#55526B]">
            {i + 1} de {STEPS.length}
          </span>
        </div>
        <h2 className="m-0 text-lg font-bold tracking-tight">{step.title}</h2>

        {step.items ? (
          <div className="flex flex-col gap-2 text-sm leading-snug">
            {shown.map((it, n) => (
              <div key={it.target} className="flex gap-2.5">
                <b className="w-3.5 shrink-0 text-[#5B3FD0]">{n + 1}</b>
                <span>{it.node}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm leading-snug text-[#3F3C52]">{step.text(present)}</p>
        )}

        {step.example === 'card' && <CardExample />}
        {step.example === 'colors' && <ColorsExample />}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="h-11 shrink-0 rounded-xl border-0 bg-transparent px-1.5 text-sm font-semibold text-[#55526B]"
          >
            Pular
          </button>
          <button
            ref={nextRef}
            type="button"
            onClick={() => (last ? onFinish() : setI((n) => n + 1))}
            className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-[#5B3FD0] text-[15px] font-bold text-white"
          >
            {last ? 'Começar a usar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

