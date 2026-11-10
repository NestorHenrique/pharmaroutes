import type { PresenceItem } from '@/lib/visits';
import { presenceText } from '@/lib/visits';

interface PresenceTagsProps {
  items: readonly PresenceItem[];
  /** quantas etiquetas mostrar antes do "+N" (padrão 2) */
  max?: number;
  className?: string;
}

/** Etiquetas "Arthur no consultório 16:50" (azul) e "Nestor visitou 16:55" (verde); o excedente vira "+3" */
export default function PresenceTags({ items, max = 2, className = '' }: PresenceTagsProps) {
  if (items.length === 0) return null;
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {shown.map((it) => (
        <span
          key={it.key}
          className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold whitespace-nowrap ${
            it.kind === 'office'
              ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
              : 'border-emerald-600/50 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {presenceText(it)}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex h-6 items-center rounded-full border border-slate-700 px-2 text-[11px] font-bold text-slate-300">
          +{extra}
        </span>
      )}
    </span>
  );
}
