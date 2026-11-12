import type { ReactNode } from 'react';

/** Título de campo/seção dos formulários de médico: texto pequeno em negrito, como no protótipo */
export default function FormTitle({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-semibold text-slate-300">{children}</span>
  );
}
