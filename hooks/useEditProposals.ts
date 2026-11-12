import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DECISION_MESSAGE, type EditProposal } from '@/lib/editProposals';

const POLL_MS = 60_000;

/**
 * Propostas de alteração (nome, CRM, UF, especialidade) ainda sem decisão, de todos os representantes.
 * `available` = a migração v14 existe; sem ela o app salva essas mudanças direto, como antes.
 */
export function useEditProposals(userId: string | null, onApplied: () => void) {
  const [pending, setPending] = useState<EditProposal[]>([]);
  const [available, setAvailable] = useState(false);
  /** o interruptor "Aprovação de edições" está ligado (começa desligado) */
  const [required, setRequiredState] = useState(false);
  const userRef = useRef(userId);
  userRef.current = userId;
  const appliedRef = useRef(onApplied);
  appliedRef.current = onApplied;

  const refetch = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('doctor_edit_proposals')
      .select('id, doctor_id, proposed_by, proposed_by_name, changes, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (userRef.current !== userId) return;
    if (error) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    setPending(data as EditProposal[]);
  }, [userId]);

  const fetchSetting = useCallback(async () => {
    const { data, error } = await supabase.from('app_settings').select('value').eq('name', 'edit_approval').maybeSingle();
    if (!error) setRequiredState((data as { value: string } | null)?.value === 'on');
  }, []);

  /** Liga/desliga para todos os representantes; devolve false se não deu */
  const setRequired = useCallback(
    async (on: boolean): Promise<boolean> => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ name: 'edit_approval', value: on ? 'on' : 'off', updated_at: new Date().toISOString() }, { onConflict: 'name' });
      if (error) return false;
      setRequiredState(on);
      return true;
    },
    [],
  );

  useEffect(() => {
    setPending([]);
    setAvailable(false);
    setRequiredState(false);
    if (!userId) return;
    void fetchSetting();
    void refetch();
    const t = setInterval(() => void refetch(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refetch, fetchSetting]);

  /** Aprovar (true) ou recusar/cancelar (false). Devolve a frase para mostrar. */
  const decide = useCallback(
    async (id: string, approve: boolean): Promise<string> => {
      const { data, error } = await supabase.rpc('decide_doctor_edit', { p_id: id, p_approve: approve });
      if (error) return 'Não foi possível decidir agora. Tente de novo.';
      await refetch();
      if (data === 'approved') appliedRef.current();
      return DECISION_MESSAGE[String(data)] ?? 'Pronto.';
    },
    [refetch],
  );

  /** Envia uma proposta; devolve false se a tabela ainda não existe (aí o app salva direto) */
  const propose = useCallback(
    async (doctorId: string, proposedByName: string, changes: object): Promise<'ok' | 'unavailable' | 'error'> => {
      const { error } = await supabase
        .from('doctor_edit_proposals')
        .insert({ doctor_id: doctorId, proposed_by_name: proposedByName, changes });
      if (!error) {
        void refetch();
        return 'ok';
      }
      if (error.code === '42P01' || error.code === 'PGRST205') return 'unavailable';
      console.error('Erro ao enviar a alteração para aprovação:', error.message);
      return 'error';
    },
    [refetch],
  );

  return { pending, available, required, setRequired, decide, propose, refetch };
}
