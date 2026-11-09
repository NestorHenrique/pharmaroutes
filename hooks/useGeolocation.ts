import { useCallback, useRef, useState } from 'react';

export type GpsStatus = { type: 'ok' | 'error'; text: string } | null;

/** Texto do botão exibido quando o iOS bloqueia o pedido no modo standalone */
export const GPS_ACTIVATE_LABEL = 'Tocar para Ativar GPS';

/** App aberto pela Tela de Início (iOS `navigator.standalone` ou display-mode: standalone) */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** 1ª tentativa: GPS preciso, posição nova, até 15 s (sinal fraco em hospital/clínica) */
const HIGH_ACCURACY: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
/** PWA standalone: 20 s e aceita posição de até 10 s (o iOS demora mais para responder) */
const STANDALONE_HIGH: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 };
const STANDALONE_LOW: PositionOptions = { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 };
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
  /** true = permissão negada no modo standalone: mostrar o botão GPS_ACTIVATE_LABEL */
  const [needsActivation, setNeedsActivation] = useState(false);
  const lastSuccess = useRef<((url: string) => void) | null>(null);

  /** SEMPRE chamar direto de um onClick/toque: nunca em useEffect ou na montagem */
  const capture = useCallback((onSuccess: (url: string) => void) => {
    lastSuccess.current = onSuccess;
    setNeedsActivation(false);
    const standalone = isStandalone();
    const high = standalone ? STANDALONE_HIGH : HIGH_ACCURACY;
    const low = standalone ? STANDALONE_LOW : LOW_ACCURACY;
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
    getPosition(high)
      .then((pos) => done(pos, false))
      .catch((err: { code?: number }) => {
        if (err?.code === PERMISSION_DENIED) {
          if (standalone) {
            // Não trava a tela: oferece um novo pedido iniciado por toque
            setNeedsActivation(true);
            setStatus({ type: 'error', text: `Localização não liberada. ${GPS_ACTIVATE_LABEL}.` });
          } else {
            setStatus({ type: 'error', text: errorText(err.code) });
          }
          setLoading(false);
          return;
        }
        // Sinal fraco ou indisponível: tenta de novo sem alta precisão
        getPosition(low)
          .then((pos) => done(pos, true))
          .catch((err2: { code?: number }) => {
            setStatus({ type: 'error', text: errorText(err2?.code) });
            setLoading(false);
          });
      });
  }, []);

  /** Novo pedido a partir do botão "Tocar para Ativar GPS" (é um toque novo do usuário) */
  const retry = useCallback(() => {
    if (lastSuccess.current) capture(lastSuccess.current);
  }, [capture]);

  return { loading, status, capture, needsActivation, retry };
}
