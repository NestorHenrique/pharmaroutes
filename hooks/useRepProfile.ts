import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RepProfile } from '@/types/doctor';

/** Linha de rep_route_order — UNIQUE(user_id, day_of_week) */
interface RouteOrderRow {
  day_of_week: string;
  ordered_doctor_ids: string[] | null;
}

/** Erro do Supabase com tudo que ajuda a diagnosticar */
function logSupabaseError(label: string, error: { message: string; details?: string | null; hint?: string | null; code?: string }) {
  console.error(label, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}

/**
 * Perfil do representante (nome, especialidades da carteira, "mostrar todos")
 * e médicos vinculados manualmente à carteira.
 * Se as tabelas ainda não existirem (migração v3 pendente), usa o padrão e não quebra.
 */
export function useRepProfile(userId: string | null) {
  const [profile, setProfile] = useState<RepProfile | null>(null);
  const [portfolio, setPortfolio] = useState<Set<string>>(new Set());
  /** ordem manual da rota por dia: { seg: [id, id, ...], geral: [...] } */
  const [routeOrder, setRouteOrder] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setPortfolio(new Set());
      setRouteOrder({});
      return;
    }
    let cancelled = false;

    (async () => {
      const [
        { data: prof, error: profErr },
        { data: links, error: linkErr },
        { data: orders, error: orderErr },
      ] = await Promise.all([
        supabase.from('rep_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('rep_portfolio').select('doctor_id').eq('user_id', userId),
        supabase.from('rep_route_order').select('day_of_week, ordered_doctor_ids').eq('user_id', userId),
      ]);
      if (cancelled) return;

      if (profErr) console.warn('Perfil indisponível:', profErr.message);
      if (linkErr) console.warn('Carteira indisponível:', linkErr.message);
      if (orderErr) logSupabaseError('Ordem manual indisponível:', orderErr);

      const orderMap: Record<string, string[]> = {};
      for (const o of (orders as RouteOrderRow[] | null) ?? []) {
        orderMap[String(o.day_of_week)] = (o.ordered_doctor_ids ?? []).map(String);
      }
      setRouteOrder(orderMap);

      const p = prof as RepProfile | null;
      setProfile({
        user_id: userId,
        display_name: p?.display_name ?? null,
        specialties: p?.specialties ?? [],
        show_all: p?.show_all ?? true,
      });
      setPortfolio(new Set(((links as { doctor_id: string }[] | null) ?? []).map((l) => l.doctor_id)));
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveProfile = useCallback(
    async (patch: Partial<Omit<RepProfile, 'user_id'>>): Promise<boolean> => {
      if (!userId) return false;
      const next: RepProfile = {
        user_id: userId,
        display_name: profile?.display_name ?? null,
        specialties: profile?.specialties ?? [],
        show_all: profile?.show_all ?? true,
        ...patch,
      };
      const prev = profile;
      setProfile(next); // otimista

      const { error } = await supabase
        .from('rep_profiles')
        .upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

      if (error) {
        console.error('Erro ao salvar perfil:', error.message);
        setProfile(prev);
        return false;
      }
      return true;
    },
    [userId, profile],
  );

  const linkDoctor = useCallback(
    async (doctorId: string): Promise<boolean> => {
      if (!userId) return false;
      const { error } = await supabase
        .from('rep_portfolio')
        .upsert({ user_id: userId, doctor_id: doctorId }, { onConflict: 'user_id,doctor_id' });
      if (error) {
        console.error('Erro ao vincular à carteira:', error.message);
        return false;
      }
      setPortfolio((prev) => new Set(prev).add(doctorId));
      return true;
    },
    [userId],
  );

  const saveRouteOrder = useCallback(
    async (day: string, doctorIds: string[]): Promise<boolean> => {
      // 1) Sessão válida: a policy de RLS compara user_id com auth.uid(),
      //    então usamos o id da sessão atual, não um valor guardado no estado.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user?.id) {
        console.error('Erro ao salvar ordem da rota: usuário não autenticado.', authError?.message ?? '');
        return false;
      }
      if (userId && user.id !== userId) {
        console.error('Erro ao salvar ordem da rota: a sessão mudou. Recarregue o app.');
        return false;
      }

      const previous = routeOrder[day];
      setRouteOrder((cur) => ({ ...cur, [day]: doctorIds })); // otimista

      // 2) Upsert com o alvo do UNIQUE(user_id, day_of_week)
      const { error } = await supabase
        .from('rep_route_order')
        .upsert(
          {
            user_id: user.id,
            day_of_week: day,
            ordered_doctor_ids: doctorIds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,day_of_week' },
        );

      if (error) {
        // 3) Log completo
        logSupabaseError('Erro ao salvar ordem da rota:', error);
        setRouteOrder((cur) => ({ ...cur, [day]: previous ?? [] }));
        return false;
      }
      return true;
    },
    [userId, routeOrder],
  );

  return { profile, portfolio, saveProfile, linkDoctor, routeOrder, saveRouteOrder };
}
