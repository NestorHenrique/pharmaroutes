import { initialsOf, type Visitor } from '@/lib/visits';

interface RepAvatarProps {
  name: string;
  src?: string | null;
  /** diâmetro em px */
  size?: number;
  /** anel dourado: é o próprio usuário */
  me?: boolean;
  className?: string;
}

/** Bolinha com a foto da pessoa; sem foto, as iniciais */
export function RepAvatar({ name, src, size = 26, me = false, className = '' }: RepAvatarProps) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 font-semibold text-slate-100 ${
        me ? 'ring-[1.5px] ring-[#c9a86a]' : ''
      } ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" draggable={false} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}

interface VisitorStackProps {
  visitors: readonly Visitor[];
  /** quantas bolinhas mostrar antes do "+N" */
  max?: number;
  size?: number;
}

/** Bolinhas sobrepostas de quem visitou; o excedente vira "+N" */
export function VisitorStack({ visitors, max = 3, size = 26 }: VisitorStackProps) {
  if (visitors.length === 0) return null;
  const shown = visitors.slice(0, max);
  const extra = visitors.length - shown.length;
  return (
    <span className="inline-flex items-center pl-2" aria-label={`${visitors.length} representante(s) visitaram`}>
      {shown.map((v) => (
        <RepAvatar
          key={v.userId}
          name={v.name}
          src={v.avatarUrl}
          me={v.isMe}
          size={size}
          className="-ml-2 border-2 border-slate-900"
        />
      ))}
      {extra > 0 && (
        <span
          style={{ width: size, height: size, fontSize: 10 }}
          className="-ml-2 inline-flex items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 font-semibold text-slate-300"
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
