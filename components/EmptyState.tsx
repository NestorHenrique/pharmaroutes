interface EmptyStateProps {
  icon: string;
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
}

/** Tela vazia com explicação e um botão para sair dela */
export default function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <span className="text-4xl" aria-hidden="true">{icon}</span>
      <p className="m-0 text-base font-semibold text-slate-100">{title}</p>
      <p className="m-0 max-w-xs text-sm leading-snug text-slate-400">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 h-11 rounded-xl border border-slate-600 bg-transparent px-5 text-sm font-semibold text-slate-100 hover:border-slate-400"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
