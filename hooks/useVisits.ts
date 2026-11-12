import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { enqueue, isNetworkError, isOffline, pendingOps } from '@/lib/offlineQueue';
import type { DoctorVisit } from '@/types/doctor';
import {
  clearUserVisits,
  groupVisits,
  myVisitDates,
  removeVisit,
  upsertVisit,
  type PublicProfile,
  type VisitMap,
} from '@/lib/visits';

const POLL_MS = 60_000;

/** Visitas feitas sem internet que ainda não subiram continuam na tela */
function overlayPendingVisits(map: VisitMap, owner: string): VisitMap {
  let out = map;
  for (const op of pendingOps(owner)) {
    if (op.kind === 'visit_upsert') out = upsertVisit(out, op.record);
    else if (op.kind === 'visit_delete') out = removeVisit(out, op.doctor_id, owner);
    else if (op.kind === 'visits_clear') out = clearUserVisits(out, owner);
  }
  return out;
}

/**
 * Visitas do ciclo de TODOS os representantes (cada um tem a sua) + nome/foto de cada um.
 * - marcar/desfazer mexe só na visita do próprio usuário;
 * - "Renovar ciclo" apaga só as visitas do próprio usuário (o histórico de horários não é tocado);
 * - sem internet, as ações vão para a fila offline.
 */
export function useVisits(userId: string | null, accessToken: string | null, actorName: string) {
  const [visitMap, setVisitMap] = useState<VisitMap>({});
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  /** representantes em modo privado (a tela mostra "Representante" no lugar do nome e da foto) */
  const [privateIds, setPrivateIds] = useState<Set<string>>(new Set());
  /** a primeira busca de visitas já terminou (com ou sem erro) */
  const [ready, setReady] = useState(false);
  const userRef = useRef(userId);
  userRef.current = userId;

  const fetchVisits = useCallback(async () => {
    if (!userId) return;
    const [{ data, error }, first] = await Promise.all([
      supabase.from('doctor_visits').select('doctor_id, user_id, rep_name, visited_at'),
      supabase.from('rep_profiles').select('user_id, display_name, avatar_url, private_mode'),
    ]);
    let { data: profs, error: profErr } = first;
    if (profErr) {
      // migração v16 ainda não rodou (sem a coluna private_mode): busca sem ela
      const retry = await supabase.from('rep_profiles').select('user_id, display_name, avatar_url');
      profs = retry.data as typeof profs;
      profErr = retry.error;
    }
    if (userRef.current !== userId) return;
    setReady(true);

    if (error) {
      // migração v7 ainda não rodou ou sem rede: mantém o que já está na tela
      console.warn('Visitas indisponíveis:', error.message);
    } else {
      setVisitMap(overlayPendingVisits(groupVisits(data as DoctorVisit[]), userId));
    }

    if (profErr) {
      console.warn('Perfis indisponíveis:', profErr.message);
    } else {
      const next: Record<string, PublicProfile> = {};
      const priv = new Set<string>();
      for (const p of (profs as ({ user_id: string; private_mode?: boolean | null } & PublicProfile)[] | null) ?? []) {
        next[p.user_id] = { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null };
        if (p.private_mode) priv.add(p.user_id);
      }
      setProfiles(next);
      setPrivateIds(priv);
    }
  }, [userId]);

  // Zera ao trocar de usuário
  useEffect(() => {
    setVisitMap({});
    setProfiles({});
    setPrivateIds(new Set());
    setReady(false);
  }, [userId]);

  // Carga + reserva a cada 60 s + ao voltar para o app
  useEffect(() => {
    if (!userId) return;
    void fetchVisits();
    const t = setInterval(() => void fetchVisits(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchVisits();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, fetchVisits]);

  // Realtime: a visita de um colega aparece em ~1 s
  useEffect(() => {
    if (!userId) return;
    if (accessToken) void supabase.realtime.setAuth(accessToken);

    const channel = supabase
      .channel(`doctor-visits-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctor_visits' },
        (payload: RealtimePostgresChangesPayload<DoctorVisit>) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<DoctorVisit>;
            if (old.doctor_id && old.user_id) {
              setVisitMap((prev) => removeVisit(prev, old.doctor_id as string, old.user_id as string));
            } else {
              void fetchVisits();
            }
            return;
          }
          const row = payload.new as DoctorVisit;
          if (row?.doctor_id && row.user_id) setVisitMap((prev) => upsertVisit(prev, row));
        },
      )
      .subscribe((state: string) => {
        if (state === 'SUBSCRIBED') void fetchVisits();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, accessToken, fetchVisits]);

  /** doctor_id -> visited_at das visitas DESTE representante */
  const myVisits = useMemo(() => myVisitDates(visitMap, userId), [visitMap, userId]);

  const markVisited = useCallback(
    /** `visitedAt`: hora da visita (padrão: agora). A pergunta "Já visitou?" usa a hora em que o status foi marcado. */
    async (doctorId: string, visitedAt?: string) => {
      if (!userId) return;
      const record: DoctorVisit = {
        doctor_id: doctorId,
        user_id: userId,
        rep_name: actorName || null,
        visited_at: visitedAt ?? new Date().toISOString(),
      };
      const previous = visitMap[doctorId]?.find((v) => v.user_id === userId);
      setVisitMap((prev) => upsertVisit(prev, record));

      const queue = () => enqueue(userId, { kind: 'visit_upsert', record });
      if (isOffline()) {
        queue();
        return;
      }
      const { error, status } = await supabase.from('doctor_visits').upsert(record, { onConflict: 'doctor_id,user_id' });
      if (error) {
        if (isNetworkError(error, status)) {
          queue();
          return;
        }
        console.error('Erro ao marcar visita:', error.message, '|', error.code);
        setVisitMap((prev) => (previous ? upsertVisit(prev, previous) : removeVisit(prev, doctorId, userId)));
      }
    },
    [userId, actorName, visitMap],
  );

  const undoVisited = useCallback(
    async (doctorId: string) => {
      if (!userId) return;
      const previous = visitMap[doctorId]?.find((v) => v.user_id === userId);
      setVisitMap((prev) => removeVisit(prev, doctorId, userId));

      const queue = () => enqueue(userId, { kind: 'visit_delete', doctor_id: doctorId });
      if (isOffline()) {
        queue();
        return;
      }
      const { error, status } = await supabase
        .from('doctor_visits')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('user_id', userId);
      if (error) {
        if (isNetworkError(error, status)) {
          queue();
          return;
        }
        console.error('Erro ao desfazer visita:', error.message, '|', error.code);
        if (previous) setVisitMap((prev) => upsertVisit(prev, previous));
      }
    },
    [userId, visitMap],
  );

  /** Renovar ciclo: apaga só as visitas deste representante */
  const renewMine = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const before = visitMap;
    setVisitMap((prev) => clearUserVisits(prev, userId));

    const queue = () => enqueue(userId, { kind: 'visits_clear' });
    if (isOffline()) {
      queue();
      return true;
    }
    const { error, status } = await supabase.from('doctor_visits').delete().eq('user_id', userId);
    if (error) {
      if (isNetworkError(error, status)) {
        queue();
        return true;
      }
      console.error('Erro ao renovar o ciclo:', error.message, '|', error.code);
      setVisitMap(before);
      return false;
    }
    return true;
  }, [userId, visitMap]);

  return { ready, visitMap, profiles, privateIds, myVisits, markVisited, undoVisited, renewMine, refetchVisits: fetchVisits };
}
