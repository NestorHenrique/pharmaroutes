const ICONS = {
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  medico: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0M19 4v4M17 6h4',
  agenda: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
} as const;

interface EmptyStateProps {
  icon: keyof typeof ICONS;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}

/** Tela vazia com explicação e um botão para sair dela */
export default function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="my-6 flex flex-col items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-7 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-blue-800 bg-blue-950 text-blue-600" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[icon]} />
        </svg>
      </span>
      <p className="m-0 text-base font-semibold text-slate-50">{title}</p>
      <p className="m-0 max-w-xs text-[13px] leading-snug text-slate-400">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1.5 h-[52px] rounded-[14px] border border-blue-800 bg-blue-950 px-5 text-base font-semibold text-blue-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
