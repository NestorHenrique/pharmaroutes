import { useCallback, useState } from 'react';

export type GpsStatus = { type: 'ok' | 'error'; text: string } | null;

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GpsStatus>(null);

  const capture = useCallback((onSuccess: (url: string) => void) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus({ type: 'error', text: 'Geolocalização não suportada neste aparelho.' });
      return;
    }
    setLoading(true);
    setStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSuccess(`https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
        setStatus({ type: 'ok', text: 'Localização capturada.' });
        setLoading(false);
      },
      () => {
        setStatus({ type: 'error', text: 'Não foi possível capturar o GPS. Verifique a permissão.' });
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return { loading, status, capture };
}
