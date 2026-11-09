interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-slate-900 border border-slate-800 px-3.5 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="size-10 shrink-0 bg-blue-600 rounded-full flex items-center justify-center font-bold text-base text-white">
          P
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Instale o app no celular</div>
          <div className="text-xs text-slate-400">Abre mais rápido e recebe notificações</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onInstall}
          className="h-9 px-3 bg-blue-600 text-white border-none rounded-xl text-xs font-bold hover:bg-blue-500"
        >
          Salvar na Tela
        </button>
        <button
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="size-9 bg-transparent border-none text-slate-400 text-sm hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
