import { useEffect, useState } from 'react';
import { DownloadIcon, XIcon } from '../ui/Icons';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    const bannerDismissed = sessionStorage.getItem('pwa_banner_dismissed');
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIphone = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIphone);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (!isStandalone && !bannerDismissed) {
      if (isIphone) {
        setShowInstallBanner(true);
      } else {
        window.addEventListener('beforeinstallprompt', (e: any) => {
          e.preventDefault();
          setDeferredPrompt(e);
          setShowInstallBanner(true);
        });
      }
    }
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') setShowInstallBanner(false);
        setDeferredPrompt(null);
      });
    } else if (isIOS) {
      alert('Para instalar no iPhone:\n\n1. Toque no botão "Compartilhar".\n2. Selecione "Adicionar à Tela de Início".');
    }
  };

  // Usa a chave que o efeito acima já lê, para o aviso não voltar na mesma sessão.
  const handleDismiss = () => {
    sessionStorage.setItem('pwa_banner_dismissed', '1');
    setShowInstallBanner(false);
  };

  if (!showInstallBanner) return null;

  return (
    <section aria-label="Instalar aplicativo" className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex w-[min(100%_-_1.5rem,760px)] items-center justify-between gap-3 py-2.5 sm:w-[min(100%_-_2rem,760px)]">
        <div className="flex min-w-0 items-center gap-2.5 text-xs font-medium text-slate-300">
          <DownloadIcon className="size-4 text-blue-400" />
          <span className="truncate">Instale o PharmaRoutes</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex h-9 items-center rounded-full bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Salvar na tela
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dispensar aviso de instalação"
            className="grid size-9 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
