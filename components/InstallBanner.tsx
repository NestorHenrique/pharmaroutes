interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div className="mx-4 mt-3 rounded-2xl bg-blue-950 border border-blue-800 px-3.5 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="size-11 shrink-0 bg-blue-900 text-blue-300 rounded-xl flex items-center justify-center font-bold text-base">
          P
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Instale o app no celular</div>
          <div className="text-[13px] text-slate-300">Abre mais rápido e recebe notificações</div>
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
