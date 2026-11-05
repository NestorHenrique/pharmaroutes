import { useEffect, useState } from 'react';

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

  if (!showInstallBanner) return null;

  return (
    <div className="install-banner">
      <div>Instale o PharmaRoutes</div>
      <button onClick={handleInstallClick}>Salvar na tela</button>
    </div>
  );
}