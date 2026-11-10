import { supabase } from '@/lib/supabase';
import { normalizeCrm } from '@/utils';

/**
 * "Buscar Dados do CRM": pede à Edge Function `crm-lookup` o nome, a especialidade e o RQE.
 * A função consulta o provedor configurado nos secrets do Supabase (a chave nunca vai ao celular).
 */

export interface CrmLookupData {
  nome: string;
  especialidade: string;
  rqe: string;
}

export type CrmLookupResult =
  | { ok: true; data: CrmLookupData }
  | { ok: false; message: string; notConfigured?: boolean };

interface FunctionReply {
  ok?: boolean;
  data?: Partial<CrmLookupData>;
  reason?: string;
  message?: string;
}

export async function lookupCrm(crm: string, uf: string): Promise<CrmLookupResult> {
  const digits = normalizeCrm(crm);
  const state = uf.trim().toUpperCase();
  if (!digits) return { ok: false, message: 'Digite o CRM para buscar.' };
  if (!/^[A-Z]{2}$/.test(state)) return { ok: false, message: 'Informe a UF com 2 letras (ex.: PI).' };

  try {
    const { data, error } = await supabase.functions.invoke('crm-lookup', { body: { crm: digits, uf: state } });
    if (error) {
      // Função não publicada (404) ou sem rede
      return {
        ok: false,
        notConfigured: true,
        message: 'A consulta de CRM não está disponível agora. Preencha os dados à mão.',
      };
    }
    const reply = (data ?? {}) as FunctionReply;
    if (reply.ok && reply.data) {
      return {
        ok: true,
        data: {
          nome: reply.data.nome ?? '',
          especialidade: reply.data.especialidade ?? '',
          rqe: reply.data.rqe ?? '',
        },
      };
    }
    return {
      ok: false,
      notConfigured: reply.reason === 'not_configured',
      message: reply.message || 'Não foi possível consultar o CRM.',
    };
  } catch {
    return { ok: false, message: 'Sem conexão para consultar o CRM. Preencha os dados à mão.' };
  }
}
