import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { enqueue, isNetworkError, isOffline } from '@/lib/offlineQueue';
import { PROMPT_STATUSES, PROMPT_WINDOW_HOURS, type VisitPrompt } from '@/lib/visitPrompts';

const POLL_MS = 60_000;

/**
 * Perguntas "Já visitou?" pendentes DESTE representante: status dele que já venceram e que ele
 * ainda não respondeu. Atualiza a cada minuto e ao voltar para o app (a notificação push abre o app).
 * Sem resposta, a pergunta continua pendente para a próxima abertura.
 */
export function useVisitPrompts(userId: string | null) {
  const [pending, setPending] = useState<VisitPrompt[]>([]);
  const userRef = useRef(userId);
  userRef.current = userId;
  /** respondidas nesta sessão: não voltam no próximo fetch enquanto a exclusão não subiu */
  const resolved = useRef<Set<string>>(new Set());

  const fetchPending = useCallback(async () => {
    if (!userId) return;
    const now = new Date();
    const since = new Date(now.getTime() - PROMPT_WINDOW_HOURS * 3_600_000).toISOString();
    const { data, error } = await supabase
      .from('doctor_statuses')
      .select('id, doctor_id, status_type, created_at, expires_at')
      .eq('created_by', userId)
      .in('status_type', [...PROMPT_STATUSES])
      .lte('expires_at', now.toISOString())
      .gte('expires_at', since)
      .order('expires_at', { ascending: true });
    if (userRef.current !== userId) return;
    if (error) {
      console.warn('Perguntas de visita indisponíveis:', error.message);
      return;
    }
    setPending((data as VisitPrompt[]).filter((p) => !resolved.current.has(p.id)));
  }, [userId]);

  useEffect(() => {
    setPending([]);
    resolved.current = new Set();
    if (!userId) return;
    void fetchPending();
    const t = setInterval(() => void fetchPending(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchPending();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, fetchPending]);

  /** Dá a pergunta por respondida: apaga a linha vencida (só se ainda for a mesma, vencida e deste usuário) */
  const resolve = useCallback(
    async (p: VisitPrompt): Promise<void> => {
      if (!userId) return;
      resolved.current.add(p.id);
      setPending((cur) => cur.filter((x) => x.id !== p.id));

      const queue = () => enqueue(userId, { kind: 'status_delete', doctor_id: p.doctor_id, status_type: p.status_type });
      if (isOffline()) {
        queue();
        return;
      }
      // Por id + dono + vencida: se um colega remarcou o mesmo status nesse meio tempo, não apaga o dele
      const { error, status } = await supabase
        .from('doctor_statuses')
        .delete()
        .eq('id', p.id)
        .eq('created_by', userId)
        .lte('expires_at', new Date().toISOString());
      if (error) {
        if (isNetworkError(error, status)) {
          queue();
          return;
        }
        console.error('Erro ao responder a pergunta de visita:', error.message, '|', error.code);
        // volta a ficar pendente para a próxima abertura
        resolved.current.delete(p.id);
        setPending((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
      }
    },
    [userId],
  );

  return { pending, resolve, refetch: fetchPending };
}
