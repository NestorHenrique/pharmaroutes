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
    <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20 }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>Instale o PharmaRoutes</div>
      <button onClick={handleInstallClick} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, boxShadow: '0 2px 10px rgba(37,99,235,0.3)' }}>Salvar na Tela</button>
    </div>
  );
}