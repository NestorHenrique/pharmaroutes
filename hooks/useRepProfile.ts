import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RepProfile } from '@/types/doctor';

/**
 * Perfil do representante (nome, especialidades da carteira, "mostrar todos")
 * e médicos vinculados manualmente à carteira.
 * Se as tabelas ainda não existirem (migração v3 pendente), usa o padrão e não quebra.
 */
export function useRepProfile(userId: string | null) {
  const [profile, setProfile] = useState<RepProfile | null>(null);
  const [portfolio, setPortfolio] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setPortfolio(new Set());
      return;
    }
    let cancelled = false;

    (async () => {
      const [{ data: prof, error: profErr }, { data: links, error: linkErr }] = await Promise.all([
        supabase.from('rep_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('rep_portfolio').select('doctor_id').eq('user_id', userId),
      ]);
      if (cancelled) return;

      if (profErr) console.warn('Perfil indisponível:', profErr.message);
      if (linkErr) console.warn('Carteira indisponível:', linkErr.message);

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

  return { profile, portfolio, saveProfile, linkDoctor };
}
