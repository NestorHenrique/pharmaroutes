import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const CACHE_PREFIX = 'pr-hidden:';

function readCache(userId: string): string[] {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeCache(userId: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

/**
 * Médicos que ESTE representante tirou do próprio painel (tabela rep_hidden_doctors).
 * O médico continua na base e no painel dos colegas. Sem a tabela (migração v13 pendente),
 * a lista fica no aparelho e sobe para o servidor quando a tabela existir.
 */
export function useHiddenDoctors(userId: string | null) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setHidden(new Set());
      return;
    }
    let cancelled = false;
    const local = readCache(userId);
    setHidden(new Set(local));
    (async () => {
      const { data, error } = await supabase.from('rep_hidden_doctors').select('doctor_id').eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        console.warn('Painel oculto indisponível (usando a cópia do aparelho):', error.message);
        return;
      }
      const server = new Set((data as { doctor_id: string }[]).map((r) => r.doctor_id));
      // o que só existe no aparelho (ocultado antes da migração v13) sobe para o servidor
      const onlyLocal = local.filter((id) => !server.has(id));
      if (onlyLocal.length > 0) {
        void supabase.from('rep_hidden_doctors').upsert(onlyLocal.map((doctor_id) => ({ user_id: userId, doctor_id })), { onConflict: 'user_id,doctor_id' });
      }
      const merged = new Set([...server, ...onlyLocal]);
      setHidden(merged);
      writeCache(userId, merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const hide = useCallback(
    async (doctorId: string) => {
      if (!userId) return;
      setHidden((cur) => {
        const next = new Set(cur).add(doctorId);
        writeCache(userId, next);
        return next;
      });
      const { error } = await supabase.from('rep_hidden_doctors').upsert({ user_id: userId, doctor_id: doctorId }, { onConflict: 'user_id,doctor_id' });
      if (error) console.warn('Não foi possível guardar no servidor (fica no aparelho):', error.message);
    },
    [userId],
  );

  const unhide = useCallback(
    async (doctorId: string) => {
      if (!userId) return;
      setHidden((cur) => {
        const next = new Set(cur);
        next.delete(doctorId);
        writeCache(userId, next);
        return next;
      });
      const { error } = await supabase.from('rep_hidden_doctors').delete().eq('user_id', userId).eq('doctor_id', doctorId);
      if (error) console.warn('Não foi possível desfazer no servidor:', error.message);
    },
    [userId],
  );

  return { hidden, hide, unhide };
}
