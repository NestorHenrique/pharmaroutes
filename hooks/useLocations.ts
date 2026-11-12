import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DoctorLocation } from '@/types/doctor';
import { cleanAgenda } from '@/lib/locations';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY: readonly DoctorLocation[] = [];

/**
 * Locais EXTRAS de atendimento (tabela doctor_places, v17). O Local 1 é o endereço do próprio médico.
 * Antes da migração a tabela não existe: o erro é ignorado e todo médico fica só com o Local 1.
 */
export function useLocations(userId: string | null) {
  const [rows, setRows] = useState<(DoctorLocation & { doctor_id: string })[]>([]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from('doctor_places').select('*').order('created_at', { ascending: true });
    if (error || !data) return;
    setRows(data.map((r) => ({ ...(r as DoctorLocation & { doctor_id: string }), agenda: cleanAgenda((r as DoctorLocation).agenda) })));
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const byDoctor = useMemo(() => {
    const map = new Map<string, DoctorLocation[]>();
    for (const r of rows) map.set(r.doctor_id, [...(map.get(r.doctor_id) ?? []), r]);
    return map;
  }, [rows]);

  const extrasOf = useCallback((doctorId: string): readonly DoctorLocation[] => byDoctor.get(doctorId) ?? EMPTY, [byDoctor]);

  /** Grava a lista de extras do médico: cria os novos, atualiza os existentes e apaga os que saíram */
  const saveExtras = useCallback(
    async (doctorId: string, next: readonly DoctorLocation[]): Promise<boolean> => {
      const current = byDoctor.get(doctorId) ?? [];
      const keep = new Set(next.map((l) => l.id));
      const fields = (l: DoctorLocation) => ({
        nome: l.nome,
        endereco: l.endereco,
        numero: l.numero,
        bairro: l.bairro,
        cidade: l.cidade,
        map_link: l.map_link,
        agenda: cleanAgenda(l.agenda),
      });
      let ok = true;
      for (const l of current) {
        if (keep.has(l.id)) continue;
        const { error } = await supabase.from('doctor_places').delete().eq('id', l.id);
        if (error) ok = false;
      }
      for (const l of next) {
        const { error } = UUID.test(l.id)
          ? await supabase.from('doctor_places').update(fields(l)).eq('id', l.id)
          : await supabase.from('doctor_places').insert({ ...fields(l), doctor_id: doctorId, created_by: userId });
        if (error) {
          console.error('Erro ao salvar local:', error.message);
          ok = false;
        }
      }
      await refetch();
      return ok;
    },
    [byDoctor, refetch, userId],
  );

  return { extrasOf, saveExtras };
}
