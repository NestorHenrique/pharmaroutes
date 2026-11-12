import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getFlag, setFlag } from '@/lib/repFlags';

/** Avisos que valem para a lista do sino */
export const NOTICE_TYPES = ['ultimo_paciente', 'representante_no_consultorio'] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export interface Notice {
  id: number;
  doctor_id: string;
  status_type: NoticeType;
  event_at: string;
  created_by: string | null;
  rep_name: string | null;
}

const POLL_MS = 60_000;
/** O sino guarda 2 dias: "Hoje" e "Ontem" */
const HISTORY_MS = 2 * 86_400_000;
const READ_FLAG = 'notif-read-at';

/**
 * Avisos dos colegas (últimos 2 dias): quem marcou "Último paciente" ou "Rep. no consultório".
 * O que é "lido" fica guardado no aparelho (instante da última vez em que se marcou tudo como lido).
 * A primeira vez que o sino aparece, o que já existia conta como lido (não nasce com dezenas de bolinhas).
 */
export function useNotifications(userId: string | null) {
  const [rows, setRows] = useState<Notice[]>([]);
  const [readAt, setReadAt] = useState<string | null>(null);
  const userRef = useRef(userId);
  userRef.current = userId;

  const fetchRows = useCallback(async () => {
    if (!userId) return;
    const since = new Date(Date.now() - HISTORY_MS).toISOString();
    const { data, error } = await supabase
      .from('doctor_status_events')
      .select('id, doctor_id, status_type, event_at, created_by, rep_name')
      .in('status_type', [...NOTICE_TYPES])
      .neq('created_by', userId)
      .gte('event_at', since)
      .order('event_at', { ascending: false })
      .limit(300);
    if (userRef.current !== userId) return;
    if (error) {
      // rep_name só existe depois da migração v9: tenta de novo sem ela
      const retry = await supabase
        .from('doctor_status_events')
        .select('id, doctor_id, status_type, event_at, created_by')
        .in('status_type', [...NOTICE_TYPES])
        .neq('created_by', userId)
        .gte('event_at', since)
        .order('event_at', { ascending: false })
        .limit(300);
      if (retry.error) {
        console.warn('Avisos indisponíveis:', retry.error.message);
        return;
      }
      setRows((retry.data as Omit<Notice, 'rep_name'>[]).map((r) => ({ ...r, rep_name: null })));
      return;
    }
    setRows(data as Notice[]);
  }, [userId]);

  useEffect(() => {
    setRows([]);
    if (!userId) {
      setReadAt(null);
      return;
    }
    let saved = getFlag(userId, READ_FLAG);
    if (!saved) {
      saved = new Date().toISOString();
      setFlag(userId, READ_FLAG, saved);
    }
    setReadAt(saved);
    void fetchRows();
    const t = setInterval(() => void fetchRows(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchRows();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, fetchRows]);

  const markAllRead = useCallback(() => {
    if (!userId) return;
    const now = new Date().toISOString();
    setFlag(userId, READ_FLAG, now);
    setReadAt(now);
  }, [userId]);

  return { rows, readAt, markAllRead, refetch: fetchRows };
}
