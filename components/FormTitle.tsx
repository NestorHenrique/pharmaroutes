import type { ReactNode } from 'react';

/** Título de seção dos formulários de médico: em destaque (cor de destaque do tema + barra) */
export default function FormTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
      <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-blue-400">{children}</span>
    </div>
  );
}
