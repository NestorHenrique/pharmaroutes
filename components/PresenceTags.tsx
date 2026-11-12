import type { PresenceItem } from '@/lib/visits';
import { presenceText } from '@/lib/visits';
import { RepAvatar } from '@/components/RepAvatar';

interface PresenceTagsProps {
  items: readonly PresenceItem[];
  /** quantas etiquetas mostrar antes do "+N" (padrão 2) */
  max?: number;
  className?: string;
}

/**
 * Etiquetas com a foto do representante: "Arthur no consultório 16:50" (azul) e
 * "Nestor visitou 16:55" (verde). É a única informação de quem esteve no médico no card:
 * foto, nome e hora juntos. O excedente vira "+3".
 */
export default function PresenceTags({ items, max = 2, className = '' }: PresenceTagsProps) {
  if (items.length === 0) return null;
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {shown.map((it) => (
        <span
          key={it.key}
          className={`inline-flex h-[26px] items-center gap-1.5 rounded-full pl-1 pr-2.5 text-xs font-medium whitespace-nowrap ${
            it.kind === 'office' ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300'
          }`}
        >
          <RepAvatar name={it.name} src={it.avatarUrl} me={it.isMe} size={18} />
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
