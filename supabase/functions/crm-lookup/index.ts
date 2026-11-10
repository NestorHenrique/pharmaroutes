// @ts-nocheck — Supabase Edge Function (Deno). Fica fora do build do Next.
//
// "Buscar Dados do CRM": recebe { crm, uf } do app e devolve { nome, especialidade, rqe }.
// O app NÃO consulta o provedor direto, para a chave nunca ir para o celular.
//
// Secrets (npx supabase secrets set ...):
//   CRM_LOOKUP_URL    URL do provedor com {crm} e {uf} (e, se precisar, {token}), por exemplo
//                     https://provedor.exemplo/cfm?crm={crm}&uf={uf}&token={token}
//   CRM_LOOKUP_TOKEN  (opcional) chave do provedor; vai em {token} e no cabeçalho Authorization: Bearer
//
// Resposta: sempre HTTP 200 com { ok: true, data } ou { ok: false, reason, message }
//   reason = not_configured | not_found | provider_error | invalid
//
// Só chamadas com usuário logado são aceitas. Os nomes dos campos do provedor são
// reconhecidos por ./map.ts; se o seu provedor usar outros, ajuste as listas de lá.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { mapCrmResponse } from './map.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const fail = (reason: string, message: string) => json({ ok: false, reason, message });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { crm?: string; uf?: string };
  try {
    body = await req.json();
  } catch {
    return fail('invalid', 'Pedido inválido.');
  }
  const crm = String(body?.crm ?? '').replace(/\D/g, '');
  const uf = String(body?.uf ?? '').trim().toUpperCase();
  if (crm.length < 2 || crm.length > 9 || !/^[A-Z]{2}$/.test(uf)) {
    return fail('invalid', 'Informe o CRM (só números) e a UF com 2 letras.');
  }

  const template = Deno.env.get('CRM_LOOKUP_URL');
  if (!template) {
    return fail('not_configured', 'A consulta de CRM ainda não foi configurada. Preencha os dados à mão.');
  }
  const token = Deno.env.get('CRM_LOOKUP_TOKEN') ?? '';
  const url = template
    .replaceAll('{crm}', encodeURIComponent(crm))
    .replaceAll('{uf}', encodeURIComponent(uf))
    .replaceAll('{token}', encodeURIComponent(token));

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return fail('not_found', `CRM ${crm}/${uf} não encontrado.`);
    if (!res.ok) {
      console.error('crm-lookup provider status', res.status);
      return fail('provider_error', 'O serviço de consulta de CRM não respondeu. Tente de novo ou preencha à mão.');
    }
    const data = mapCrmResponse(await res.json());
    if (!data) return fail('not_found', `CRM ${crm}/${uf} não encontrado.`);
    return json({ ok: true, data });
  } catch (err) {
    console.error('crm-lookup error', err?.message);
    return fail('provider_error', 'O serviço de consulta de CRM não respondeu. Tente de novo ou preencha à mão.');
  }
});
