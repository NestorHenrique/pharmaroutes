import { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa_banner_dismissed';

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      /* sessionStorage indisponível */
    }

    const iphone = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    setIsIOS(iphone);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (standalone || dismissed) return;

    if (iphone) {
      setShowBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(() => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') setShowBanner(false);
        setDeferredPrompt(null);
      });
    } else if (isIOS) {
      alert(
        'Para instalar no iPhone:\n\n1. Toque no botão de "Compartilhar" (ícone com quadrado e seta para cima no rodapé do Safari).\n2. Selecione "Adicionar à Tela de Início".',
      );
    }
  }, [deferredPrompt, isIOS]);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  return { showBanner, install, dismiss };
}
