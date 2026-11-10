import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '@/lib/geocode';
import type { ReverseAddress } from '@/lib/geocode';

export type GpsStatus = { type: 'ok' | 'error'; text: string } | null;

/** Texto do botão exibido quando o iOS bloqueia o pedido */
export const GPS_ACTIVATE_LABEL = 'Tocar para Ativar GPS';
/** Texto do botão de plano C: usar o endereço digitado como link do Maps */
export const GPS_ADDRESS_FALLBACK_LABEL = 'Usar endereço digitado';

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

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

/** Dentro de iframe sem allow="geolocation" o WebKit nega sem perguntar */
function inFrame(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/** iOS / PWA standalone: aceita posição de até 30 s para responder rápido */
const IOS_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };
/** Demais aparelhos: GPS preciso e posição nova */
const DEFAULT_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
/** Corrida paralela (WebKit): watchPosition por rede/Wi-Fi, iniciado no MESMO toque */
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 };

/** O iOS às vezes nunca chama nenhum callback no standalone: trava de segurança */
const GUARD_MS = 22000;

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

function deniedText(): string {
  if (!isIOS()) return 'Localização bloqueada. Permita a localização para este site nas configurações do navegador.';
  return isStandalone()
    ? 'Localização bloqueada pelo iPhone. Ajustes › Privacidade e Segurança › Serviços de Localização: deixe LIGADO e em "Sites do Safari" escolha "Ao Usar o App" (e ative "Localização Precisa"). Depois feche o app por completo e abra de novo.'
    : 'Localização bloqueada. No iPhone: Ajustes › Privacidade e Segurança › Serviços de Localização › Sites do Safari › "Ao Usar o App".';
}

const TIMEOUT_TEXT = 'O GPS não respondeu (sinal fraco). Vá para perto de uma janela ou porta e tente de novo.';
const UNAVAILABLE_TEXT = 'Não foi possível capturar o GPS. Verifique se a localização do aparelho está ligada.';

/** Diagnóstico curto no fim da mensagem: ajuda a descobrir o que o iPhone está fazendo */
function diag(code: number | string, permission: PermissionState): string {
  const mode = isStandalone() ? 'app' : 'navegador';
  return ` [${code} · ${permission} · ${mode}]`;
}

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Posição devolvida junto com o link do Maps */
export interface GeoPoint {
  lat: number;
  lon: number;
  /** precisão em metros */
  accuracy: number;
}

export interface CaptureOptions {
  /** endereço digitado: vira link do Maps se o GPS falhar (plano C) */
  fallbackAddress?: string;
  /**
   * Se informado, depois de capturar a posição busca endereço, bairro e cidade
   * (geocodificação reversa) e entrega aqui para preencher o formulário.
   */
  onAddress?: (address: ReverseAddress) => void;
}

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GpsStatus>(null);
  /** true = permissão negada/sem resposta: mostrar o botão GPS_ACTIVATE_LABEL */
  const [needsActivation, setNeedsActivation] = useState(false);
  /** link do Maps montado pelo endereço, oferecido quando o GPS falha */
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const lastSuccess = useRef<((url: string, point?: GeoPoint) => void) | null>(null);
  const lastOptions = useRef<CaptureOptions | undefined>(undefined);
  /** cada toque é uma tentativa; respostas atrasadas de tentativas antigas são ignoradas */
  const attempt = useRef(0);
  /** estado da permissão lido em segundo plano (NÃO chama o GPS, só consulta) */
  const permission = useRef<PermissionState>('unknown');

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => {
      if (status) permission.current = status.state as PermissionState;
    };
    // Safari 16+ suporta permissions.query('geolocation'); em versões antigas só fica 'unknown'
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        status = s;
        update();
        s.addEventListener?.('change', update);
      })
      .catch(() => {
        /* sem Permissions API */
      });
    return () => status?.removeEventListener?.('change', update);
  }, []);

  /**
   * SEMPRE chamar direto de um onClick/toque. getCurrentPosition E watchPosition são
   * invocados de forma síncrona aqui dentro (nada de await/Promise antes), que é o que o
   * WebKit exige para mostrar o pedido de permissão no app da Tela de Início.
   */
  const capture = useCallback((onSuccess: (url: string, point?: GeoPoint) => void, opts?: CaptureOptions) => {
    lastSuccess.current = onSuccess;
    lastOptions.current = opts;
    const address = opts?.fallbackAddress?.trim() || '';

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus({ type: 'error', text: 'Geolocalização não suportada neste aparelho.' });
      setFallbackUrl(address ? mapsSearchUrl(address) : null);
      return;
    }

    const id = ++attempt.current;
    const geo = navigator.geolocation;
    const options = isIOS() || isStandalone() ? IOS_OPTIONS : DEFAULT_OPTIONS;
    let settled = false;
    let watchId: number | null = null;
    let lastErrorCode: number | null = null;
    let guard: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      settled = true;
      if (guard) clearTimeout(guard);
      if (watchId !== null) geo.clearWatch(watchId);
      watchId = null;
    };

    /** Geocodificação reversa: roda DEPOIS do toque (só o pedido de GPS precisa do gesto) */
    const lookupAddress = async (lat: number, lon: number, base: string, onAddress: (a: ReverseAddress) => void) => {
      const addr = await reverseGeocode(lat, lon);
      if (id !== attempt.current) return; // outro toque já começou
      if (!addr) {
        setStatus({ type: 'ok', text: `${base} Não achei o endereço; confira e preencha à mão.` });
        return;
      }
      onAddress(addr);
      const street = addr.numero ? `${addr.endereco}, ${addr.numero}` : addr.endereco;
      const line = [street, addr.bairro, addr.cidade].filter(Boolean).join(' · ');
      setStatus({ type: 'ok', text: `${base} Endereço preenchido: ${line}. Confira antes de salvar.` });
    };

    const success = (pos: GeolocationPosition, reduced: boolean) => {
      if (settled || id !== attempt.current) return;
      finish();
      const { latitude, longitude, accuracy } = pos.coords;
      onSuccess(`https://www.google.com/maps?q=${latitude},${longitude}`, { lat: latitude, lon: longitude, accuracy });
      setNeedsActivation(false);
      setFallbackUrl(null);
      const base = `Localização capturada (±${Math.round(accuracy)} m)${reduced ? ' · precisão reduzida' : ''}.`;
      setStatus({ type: 'ok', text: opts?.onAddress ? `${base} Buscando endereço…` : base });
      setLoading(false);
      if (opts?.onAddress) void lookupAddress(latitude, longitude, base, opts.onAddress);
    };

    const fail = (code: number) => {
      if (settled || id !== attempt.current) return;
      finish();
      const base = code === PERMISSION_DENIED ? deniedText() : code === TIMEOUT ? TIMEOUT_TEXT : UNAVAILABLE_TEXT;
      // Aviso em linha, não bloqueia o formulário
      setStatus({ type: 'error', text: base + diag(code, permission.current) });
      setNeedsActivation(true);
      setFallbackUrl(address ? mapsSearchUrl(address) : null);
      setLoading(false);
    };

    /** Um erro só encerra se for permissão negada; senão espera a outra fonte responder */
    const onError = (err: GeolocationPositionError) => {
      if (err.code === PERMISSION_DENIED) {
        fail(PERMISSION_DENIED);
        return;
      }
      if (lastErrorCode !== null) fail(err.code); // as duas fontes falharam
      else lastErrorCode = err.code;
    };

    // 1) Duas fontes em paralelo, AMBAS dentro do toque — nenhuma linha assíncrona antes.
    //    No iOS standalone o getCurrentPosition às vezes nunca volta; o watchPosition costuma voltar.
    geo.getCurrentPosition((pos) => success(pos, false), onError, options);
    try {
      watchId = geo.watchPosition((pos) => success(pos, pos.coords.accuracy > 100), onError, WATCH_OPTIONS);
    } catch {
      watchId = null;
      lastErrorCode = lastErrorCode ?? TIMEOUT;
    }
    guard = setTimeout(() => fail(lastErrorCode ?? TIMEOUT), GUARD_MS);

    // 2) Estado da tela só depois do pedido já ter sido feito
    setLoading(true);
    setStatus(null);
    setNeedsActivation(false);
    setFallbackUrl(null);

    // Avisos de ambiente (não impedem a tentativa acima)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus({ type: 'error', text: 'O GPS só funciona com o app aberto em https://. Reinstale o app pelo endereço https.' });
    } else if (inFrame()) {
      setStatus({ type: 'error', text: 'O app está dentro de outra página (iframe). Abra o endereço do app diretamente.' });
    }
  }, []);

  /** Novo pedido a partir do botão "Tocar para Ativar GPS" (é um toque novo do usuário) */
  const retry = useCallback(() => {
    if (lastSuccess.current) capture(lastSuccess.current, lastOptions.current);
  }, [capture]);

  /** Plano C: grava o link do Maps montado pelo endereço digitado */
  const applyAddressFallback = useCallback(() => {
    if (!fallbackUrl || !lastSuccess.current) return;
    lastSuccess.current(fallbackUrl);
    setStatus({ type: 'ok', text: 'Link do Maps criado pelo endereço. Confira no mapa antes de salvar.' });
    setNeedsActivation(false);
    setFallbackUrl(null);
  }, [fallbackUrl]);

  /** Fecha o aviso */
  const dismiss = useCallback(() => setStatus(null), []);

  return { loading, status, capture, needsActivation, retry, fallbackUrl, applyAddressFallback, dismiss };
}
