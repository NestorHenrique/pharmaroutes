import { useCallback, useRef, useState } from 'react';

export type GpsStatus = { type: 'ok' | 'error'; text: string } | null;

/** Texto do botão exibido quando o iOS bloqueia o pedido */
export const GPS_ACTIVATE_LABEL = 'Tocar para Ativar GPS';

/** App aberto pela Tela de Início (iOS `navigator.standalone` ou display-mode: standalone) */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPad com iPadOS se apresenta como Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** iOS / PWA standalone: aceita posição de até 30 s para responder rápido */
const IOS_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };
/** Demais aparelhos: GPS preciso e posição nova */
const DEFAULT_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
/** Plano B (WebKit): watchPosition por rede/Wi-Fi quando o getCurrentPosition não responde */
const FALLBACK_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 };

/** O iOS às vezes nunca chama o callback no modo standalone: trava de segurança */
const GUARD_MARGIN_MS = 2000;

const PERMISSION_DENIED = 1;

function deniedText(): string {
  if (!isIOS()) return 'Localização bloqueada. Permita a localização para este site nas configurações do navegador.';
  return isStandalone()
    ? 'Localização bloqueada pelo iPhone. Em Ajustes › Privacidade e Segurança › Serviços de Localização, ligue a localização e em "Sites do Safari" escolha "Ao Usar o App". Depois toque no botão abaixo.'
    : 'Localização bloqueada. No iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › "Ao Usar o App".';
}

const TIMEOUT_TEXT = 'O GPS demorou demais (sinal fraco). Vá para perto de uma janela ou porta e tente de novo.';
const UNAVAILABLE_TEXT = 'Não foi possível capturar o GPS. Verifique se a localização do aparelho está ligada.';

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GpsStatus>(null);
  /** true = permissão negada/sem resposta: mostrar o botão GPS_ACTIVATE_LABEL */
  const [needsActivation, setNeedsActivation] = useState(false);
  const lastSuccess = useRef<((url: string) => void) | null>(null);
  /** cada toque é uma tentativa; respostas atrasadas de tentativas antigas são ignoradas */
  const attempt = useRef(0);

  /**
   * SEMPRE chamar direto de um onClick/toque. O getCurrentPosition é invocado de forma
   * síncrona aqui dentro (sem await/Promise antes), que é o que o WebKit exige para
   * mostrar o pedido de permissão no app da Tela de Início.
   */
  const capture = useCallback((onSuccess: (url: string) => void) => {
    lastSuccess.current = onSuccess;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus({ type: 'error', text: 'Geolocalização não suportada neste aparelho.' });
      return;
    }

    const id = ++attempt.current;
    const geo = navigator.geolocation;
    const ios = isIOS() || isStandalone();
    const options = ios ? IOS_OPTIONS : DEFAULT_OPTIONS;
    let settled = false;
    let watchId: number | null = null;
    let guard: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      settled = true;
      if (guard) clearTimeout(guard);
      if (watchId !== null) geo.clearWatch(watchId);
      watchId = null;
    };

    const success = (pos: GeolocationPosition, reduced: boolean) => {
      if (settled || id !== attempt.current) return;
      finish();
      const { latitude, longitude, accuracy } = pos.coords;
      onSuccess(`https://www.google.com/maps?q=${latitude},${longitude}`);
      setNeedsActivation(false);
      setStatus({
        type: 'ok',
        text: `Localização capturada (±${Math.round(accuracy)} m)${reduced ? ' · precisão reduzida' : ''}.`,
      });
      setLoading(false);
    };

    const fail = (text: string, offerRetry: boolean) => {
      if (settled || id !== attempt.current) return;
      finish();
      // Aviso em linha, não bloqueia o formulário
      setStatus({ type: 'error', text });
      setNeedsActivation(offerRetry);
      setLoading(false);
    };

    /** Plano B: watchPosition costuma responder quando o getCurrentPosition trava no iOS */
    const fallback = () => {
      if (settled || id !== attempt.current) return;
      if (guard) clearTimeout(guard);
      guard = setTimeout(
        () => fail(TIMEOUT_TEXT, true),
        (FALLBACK_OPTIONS.timeout ?? 15000) + GUARD_MARGIN_MS,
      );
      watchId = geo.watchPosition(
        (pos) => success(pos, true),
        (err) => {
          if (err.code === PERMISSION_DENIED) fail(deniedText(), true);
          else fail(err.code === err.TIMEOUT ? TIMEOUT_TEXT : UNAVAILABLE_TEXT, true);
        },
        FALLBACK_OPTIONS,
      );
    };

    // 1) Chamada síncrona dentro do toque — nada de await antes desta linha
    geo.getCurrentPosition(
      (pos) => success(pos, false),
      (err) => {
        if (err.code === PERMISSION_DENIED) fail(deniedText(), true);
        else fallback(); // sinal fraco/indisponível: tenta pela rede
      },
      options,
    );
    guard = setTimeout(fallback, (options.timeout ?? 15000) + GUARD_MARGIN_MS);

    // 2) Estado da tela só depois do pedido já ter sido feito
    setLoading(true);
    setStatus(null);
    setNeedsActivation(false);

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus({ type: 'error', text: 'O GPS só funciona com o app aberto em https://.' });
    }
  }, []);

  /** Novo pedido a partir do botão "Tocar para Ativar GPS" (é um toque novo do usuário) */
  const retry = useCallback(() => {
    if (lastSuccess.current) capture(lastSuccess.current);
  }, [capture]);

  /** Fecha o aviso */
  const dismiss = useCallback(() => setStatus(null), []);

  return { loading, status, capture, needsActivation, retry, dismiss };
}
