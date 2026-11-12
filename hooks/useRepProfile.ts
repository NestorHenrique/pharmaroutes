import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RepProfile } from '@/types/doctor';
import { REP_PROFILE_V12_KEYS } from '@/types/doctor';
import { enqueue, isNetworkError, isOffline, pendingOps } from '@/lib/offlineQueue';

/* Cópia da ordem da rota no aparelho: abre igual mesmo sem sinal e nunca parte de uma lista vazia */
const ORDER_CACHE_PREFIX = 'pr-route-order:';

function loadOrderCache(userId: string): Record<string, string[]> | null {
  try {
    const raw = localStorage.getItem(ORDER_CACHE_PREFIX + userId);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.map(String);
    }
    return out;
  } catch {
    return null;
  }
}

function saveOrderCache(userId: string, map: Record<string, string[]>): void {
  try {
    localStorage.setItem(ORDER_CACHE_PREFIX + userId, JSON.stringify(map));
  } catch { /* sem espaço ou modo privado: segue sem cópia */ }
}

/** Ordens feitas sem internet que ainda não subiram continuam valendo */
function overlayPendingOrders(map: Record<string, string[]>, owner: string): Record<string, string[]> {
  let out = map;
  for (const op of pendingOps(owner)) {
    if (op.kind === 'route_order') out = { ...out, [op.day]: op.doctor_ids };
  }
  return out;
}

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
    // Abre já com a ordem salva no aparelho; a busca abaixo atualiza em seguida
    const cachedOrder = loadOrderCache(userId);
    setRouteOrder(cachedOrder ? overlayPendingOrders(cachedOrder, userId) : {});

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

      if (orderErr) {
        // Sem rede (ou erro do servidor): usa a cópia do aparelho, nunca uma lista vazia.
        // Partir de {} fazia o próximo arrastar/visitar gravar só parte da rota por cima da salva.
        const cached = loadOrderCache(userId);
        if (cached) setRouteOrder(overlayPendingOrders(cached, userId));
      } else {
        const orderMap: Record<string, string[]> = {};
        for (const o of (orders as RouteOrderRow[] | null) ?? []) {
          orderMap[String(o.day_of_week)] = (o.ordered_doctor_ids ?? []).map(String);
        }
        const merged = overlayPendingOrders(orderMap, userId);
        setRouteOrder(merged);
        saveOrderCache(userId, merged);
      }

      const p = prof as RepProfile | null;
      setProfile({
        user_id: userId,
        display_name: p?.display_name ?? null,
        specialties: p?.specialties ?? [],
        show_all: p?.show_all ?? true,
        avatar_url: p?.avatar_url ?? null,
        // v12: ausentes até a migração rodar
        name_confirmed_at: p?.name_confirmed_at ?? null,
        tour_seen_at: p?.tour_seen_at ?? null,
        notify_enabled: p?.notify_enabled ?? true,
        active_week: p?.active_week ?? null,
        active_week_monday: p?.active_week_monday ?? null,
        terms_accepted_at: p?.terms_accepted_at ?? null,
        terms_version: p?.terms_version ?? null,
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
        avatar_url: profile?.avatar_url ?? null,
        ...patch,
      };
      const prev = profile;
      setProfile(next); // otimista

      const row: Record<string, unknown> = { ...next, updated_at: new Date().toISOString() };
      let { error } = await supabase.from('rep_profiles').upsert(row, { onConflict: 'user_id' });

      // Migração v12 ainda não rodou: grava sem as colunas novas (elas ficam só na tela/aparelho)
      if (error && (error.code === 'PGRST204' || /column/i.test(error.message ?? ''))) {
        for (const k of REP_PROFILE_V12_KEYS) delete row[k];
        ({ error } = await supabase.from('rep_profiles').upsert(row, { onConflict: 'user_id' }));
      }

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
      //    Sem internet não dá para perguntar ao servidor: usa o id da sessão já aberta.
      let uid = userId;
      if (!isOffline()) {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError && isNetworkError(authError, (authError as { status?: number }).status)) {
          // a rede caiu agora: segue com o id da sessão e guarda na fila
        } else if (authError || !user?.id) {
          console.error('Erro ao salvar ordem da rota: usuário não autenticado.', authError?.message ?? '');
          return false;
        } else {
          if (userId && user.id !== userId) {
            console.error('Erro ao salvar ordem da rota: a sessão mudou. Recarregue o app.');
            return false;
          }
          uid = user.id;
        }
      }
      if (!uid) {
        console.error('Erro ao salvar ordem da rota: usuário não autenticado.');
        return false;
      }
      const owner = uid;

      const previous = routeOrder[day];
      setRouteOrder((cur) => {
        const next = { ...cur, [day]: doctorIds }; // otimista
        saveOrderCache(owner, next);
        return next;
      });

      // Sem internet: a ordem fica no aparelho e sobe quando a conexão voltar
      const queue = () => enqueue(owner, { kind: 'route_order', day, doctor_ids: doctorIds });
      if (isOffline()) {
        queue();
        return true;
      }

      // 2) Upsert com o alvo do UNIQUE(user_id, day_of_week)
      const { error, status } = await supabase
        .from('rep_route_order')
        .upsert(
          {
            user_id: owner,
            day_of_week: day,
            ordered_doctor_ids: doctorIds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,day_of_week' },
        );

      if (error) {
        if (isNetworkError(error, status)) {
          queue();
          return true;
        }
        // 3) Log completo
        logSupabaseError('Erro ao salvar ordem da rota:', error);
        setRouteOrder((cur) => {
          const next = { ...cur, [day]: previous ?? [] };
          saveOrderCache(owner, next);
          return next;
        });
        return false;
      }
      return true;
    },
    [userId, routeOrder],
  );

  return { profile, portfolio, saveProfile, linkDoctor, routeOrder, saveRouteOrder };
}
