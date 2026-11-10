import { supabase } from '@/lib/supabase';
import { isNetworkError } from '@/lib/offlineQueue';
import type { ExecResult, QueuedOp } from '@/lib/offlineQueue';

/** Resultado de uma gravação: ok / tenta depois (rede) / descarta (o servidor recusou) */
function classify(label: string, error: { message?: string; code?: string } | null, status?: number): ExecResult {
  if (!error) return 'done';
  if (isNetworkError(error, status)) return 'retry';
  console.warn(`Pendência descartada (${label}):`, error.message, error.code ?? '');
  return 'drop';
}

/** Envia UMA operação da fila ao Supabase (chamada por flushQueue) */
export async function executeOp(op: QueuedOp): Promise<ExecResult> {
  try {
    switch (op.kind) {
      case 'status_upsert': {
        // Venceu enquanto estava sem internet: não adianta mais gravar
        if (op.record.expires_at && new Date(op.record.expires_at).getTime() <= Date.now()) return 'drop';
        const { error, status } = await supabase
          .from('doctor_statuses')
          .upsert(op.record, { onConflict: 'doctor_id,status_type' });
        return classify('status', error, status);
      }
      case 'status_delete': {
        const { error, status } = await supabase
          .from('doctor_statuses')
          .delete()
          .eq('doctor_id', op.doctor_id)
          .eq('status_type', op.status_type);
        return classify('limpar status', error, status);
      }
      case 'doctor_update': {
        const { error, status } = await supabase.from('doctors').update(op.fields).eq('id', op.doctor_id);
        return classify('edição de médico', error, status);
      }
      case 'route_order': {
        const { error, status } = await supabase.from('rep_route_order').upsert(
          {
            user_id: op.owner,
            day_of_week: op.day,
            ordered_doctor_ids: op.doctor_ids,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,day_of_week' },
        );
        return classify('ordem da rota', error, status);
      }
    }
  } catch (err) {
    // fetch que explode sem virar { error }: trata como falha de rede
    console.warn('Falha ao enviar pendência:', (err as Error).message);
    return 'retry';
  }
}
