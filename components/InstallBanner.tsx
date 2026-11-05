interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between sticky top-0 z-20 h-[53px] box-border">
      <div className="flex items-center gap-2.5">
        <div className="size-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-base text-white">
          P
        </div>
        <div>
          <div className="text-xs font-bold text-white">Facilite seu trabalho em campo</div>
          <div className="text-[11px] text-slate-400">Adicione o PharmaRoutes no seu celular</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onInstall}
          className="bg-blue-600 text-white border-none px-2.5 py-1.5 rounded-md text-[11px] font-semibold hover:bg-blue-500"
        >
          Salvar na Tela
        </button>
        <button
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="bg-transparent border-none text-slate-400 text-sm p-1 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
