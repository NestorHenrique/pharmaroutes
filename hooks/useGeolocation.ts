import { useCallback, useState } from 'react';

export type GpsStatus = { type: 'ok' | 'error'; text: string } | null;

/** 1ª tentativa: GPS preciso, posição nova, até 15 s (sinal fraco em hospital/clínica) */
const HIGH_ACCURACY: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
/** 2ª tentativa: rede/Wi-Fi, aceita posição de até 1 min, mais 15 s */
const LOW_ACCURACY: PositionOptions = { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 };

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad com iPadOS se apresenta como Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * getCurrentPosition em Promise, com trava de segurança:
 * no iOS aberto pela Tela de Início o callback às vezes nunca volta.
 */
function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const guard = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject({ code: TIMEOUT, message: 'timeout' });
    }, (options.timeout ?? 15000) + 2000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve(pos);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        reject(err);
      },
      options,
    );
  });
}

function errorText(code: number | undefined): string {
  if (code === PERMISSION_DENIED) {
    return isIOS()
      ? 'Localização bloqueada. No iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › "Ao Usar o App". Depois feche e abra o app.'
      : 'Localização bloqueada. Permita a localização para este site nas configurações do navegador.';
  }
  if (code === TIMEOUT) {
    return 'O GPS demorou demais (sinal fraco). Vá para perto de uma janela ou porta e tente de novo.';
  }
  return 'Não foi possível capturar o GPS. Verifique se a localização do aparelho está ligada.';
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GpsStatus>(null);

  const capture = useCallback((onSuccess: (url: string) => void) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus({ type: 'error', text: 'Geolocalização não suportada neste aparelho.' });
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus({ type: 'error', text: 'O GPS só funciona com o app aberto em https://.' });
      return;
    }

    setLoading(true);
    setStatus(null);

    const done = (pos: GeolocationPosition, reduced: boolean) => {
      const { latitude, longitude, accuracy } = pos.coords;
      onSuccess(`https://www.google.com/maps?q=${latitude},${longitude}`);
      setStatus({
        type: 'ok',
        text: `Localização capturada (±${Math.round(accuracy)} m)${reduced ? ' · precisão reduzida' : ''}.`,
      });
      setLoading(false);
    };

    // A 1ª chamada acontece ainda dentro do toque no botão (exigência do iOS)
    getPosition(HIGH_ACCURACY)
      .then((pos) => done(pos, false))
      .catch((err: { code?: number }) => {
        if (err?.code === PERMISSION_DENIED) {
          setStatus({ type: 'error', text: errorText(err.code) });
          setLoading(false);
          return;
        }
        // Sinal fraco ou indisponível: tenta de novo sem alta precisão
        getPosition(LOW_ACCURACY)
          .then((pos) => done(pos, true))
          .catch((err2: { code?: number }) => {
            setStatus({ type: 'error', text: errorText(err2?.code) });
            setLoading(false);
          });
      });
  }, []);

  return { loading, status, capture };
}
