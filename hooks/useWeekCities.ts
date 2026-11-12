import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Cidades de cada semana do ciclo (1..5) DESTE representante: chaves de cidade (cityKey) */
export type WeekCities = Record<number, string[]>;

const CACHE_PREFIX = 'pr-week-cities:';

function readCache(userId: string): WeekCities {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: WeekCities = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[Number(k)] = v.map(String);
    }
    return out;
  } catch {
    return {};
  }
}

function writeCache(userId: string, map: WeekCities): void {
  try {
    localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(map));
  } catch { /* ignore */ }
}

/**
 * Cidades por semana e por representante (tabela rep_week_cities).
 * Elas decidem de quais cidades o representante recebe avisos; NÃO escondem médicos da lista.
 * Sem a tabela (migração v12 pendente) ou sem internet, usa a cópia do aparelho.
 */
export function useWeekCities(userId: string | null) {
  const [byWeek, setByWeek] = useState<WeekCities>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!userId) {
      setByWeek({});
      return;
    }
    let cancelled = false;
    setByWeek(readCache(userId));
    (async () => {
      const { data, error } = await supabase.from('rep_week_cities').select('week, cities').eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        console.warn('Cidades por semana indisponíveis (usando a cópia do aparelho):', error.message);
      } else {
        const map: WeekCities = {};
        for (const r of (data as { week: number; cities: string[] | null }[]) ?? []) {
          map[r.week] = (r.cities ?? []).map(String);
        }
        setByWeek(map);
        writeCache(userId, map);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Salva as cidades de uma semana. Sempre guarda no aparelho; devolve false se o servidor recusou. */
  const save = useCallback(
    async (week: number, cities: string[]): Promise<boolean> => {
      if (!userId) return false;
      const clean = [...new Set(cities)];
      setByWeek((cur) => {
        const next = { ...cur, [week]: clean };
        writeCache(userId, next);
        return next;
      });
      const { error } = await supabase
        .from('rep_week_cities')
        .upsert({ user_id: userId, week, cities: clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id,week' });
      if (error) {
        console.warn('Não foi possível salvar as cidades da semana no servidor:', error.message);
        return false;
      }
      return true;
    },
    [userId],
  );

  return { byWeek, ready, save };
}
