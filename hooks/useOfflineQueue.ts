import { useCallback, useEffect, useRef, useState } from 'react';
import { flushQueue, isOffline, pendingOps, subscribeQueue } from '@/lib/offlineQueue';
import { executeOp } from '@/lib/offlineSync';

/** Tenta de novo a cada tanto enquanto houver pendência (o iOS diz "online" mesmo sem sinal) */
const RETRY_MS = 20_000;

/**
 * Acompanha a conexão e a fila offline do usuário.
 * - `online`: o aparelho se diz com internet;
 * - `pending`: quantas alterações esperam para subir;
 * - `onSynced`: chamado depois que algo subiu (o app recarrega médicos/status).
 * Envia sozinho ao voltar a conexão, ao abrir o app, ao voltar para o app e a cada 20 s.
 */
export function useOfflineQueue(userId: string | null, onSynced: () => void) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    onSyncedRef.current = onSynced;
  }, [onSynced]);

  const refresh = useCallback(() => setPending(userId ? pendingOps(userId).length : 0), [userId]);

  const sync = useCallback(async () => {
    if (!userId || isOffline() || pendingOps(userId).length === 0) return;
    setSyncing(true);
    try {
      const result = await flushQueue(userId, executeOp);
      if (result.sent + result.dropped > 0) onSyncedRef.current();
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [userId, refresh]);

  useEffect(() => {
    setOnline(!isOffline());
    refresh();

    const goOnline = () => {
      setOnline(true);
      void sync();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = subscribeQueue(refresh);
    const timer = setInterval(() => void sync(), RETRY_MS);
    void sync(); // sobrou algo de uma sessão anterior?

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
      clearInterval(timer);
    };
  }, [sync, refresh]);

  return { online, pending, syncing, sync };
}
