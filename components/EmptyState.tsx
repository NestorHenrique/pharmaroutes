interface EmptyStateProps {
  icon: string;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}

/** Tela vazia com explicação e um botão para sair dela */
export default function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="mx-4 my-6 flex flex-col items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-blue-950 text-2xl" aria-hidden="true">{icon}</span>
      <p className="m-0 text-base font-semibold text-slate-50">{title}</p>
      <p className="m-0 max-w-xs text-[13px] leading-snug text-slate-400">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1.5 h-11 rounded-xl border border-blue-800 bg-blue-950 px-[18px] text-sm font-semibold text-blue-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
