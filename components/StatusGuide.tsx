'use client';

import BottomSheet from '@/components/BottomSheet';

/**
 * Guia de cores e status. Fonte única: o link "Ver guia de cores e status" da folha de status
 * e o "?" do topo abrem este mesmo componente.
 */

const STEPS = [
  'Toque na bandeira do card do médico.',
  'Escolha o status. Ele já fica marcado e os colegas veem na hora.',
];

const COLORS: { dot: string; title: string; text: string }[] = [
  { dot: 'bg-sky-400', title: 'Azul · Rep. no consultório', text: 'Você está lá agora. Vale 10 min e avisa os colegas da cidade.' },
  { dot: 'bg-amber-400', title: 'Amarelo · Aguardando médico', text: 'Esperando ser atendido. Vale 30 min.' },
  { dot: 'bg-red-400', title: 'Vermelho · Último paciente', text: 'O médico está no último paciente. Vale 30 min e avisa a cidade.' },
  { dot: 'bg-emerald-400', title: 'Verde · Já visitei', text: 'Visita feita neste ciclo. O médico sai da rota.' },
  { dot: 'bg-slate-400', title: 'Cinza · Finalizou / Não veio hoje', text: 'O médico não atende mais hoje. Volta à rota amanhã.' },
  { dot: 'bg-amber-500', title: 'Âmbar · Licença, Afastado, Férias, Viagem', text: 'Ausente até o dia antes da volta. Depois entra sozinho na rota.' },
];

export default function StatusGuide({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet
      title="Guia de cores e status"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-blue-600 text-sm font-bold text-white hover:bg-blue-500"
        >
          Entendi
        </button>
      }
    >
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Como marcar em 2 toques</h3>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-sm text-slate-200">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <p className="m-0 text-xs text-slate-400">Para tirar, toque no mesmo status de novo.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cores</h3>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {COLORS.map((c) => (
            <li key={c.title} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5">
              <span className={`mt-1.5 size-3 shrink-0 rounded-full ${c.dot}`} aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-100">{c.title}</span>
                <span className="text-xs leading-snug text-slate-400">{c.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5">
        <h3 className="m-0 text-sm font-semibold text-slate-100">Horário médio</h3>
        <p className="m-0 text-xs leading-snug text-slate-400">
          É a média da hora em que os representantes chegaram a esse médico naquele dia da semana e turno. Aparece no card
          (ex.: 09:40) e ajuda a planejar a ordem da rota.
        </p>
      </section>
    </BottomSheet>
  );
}
