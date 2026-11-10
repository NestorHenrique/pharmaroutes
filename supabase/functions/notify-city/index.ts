// @ts-nocheck — Supabase Edge Function (Deno). Fica fora do build do Next.
//
// Envia Web Push para os representantes inscritos na cidade do médico quando
// alguém marca "Último Paciente" ou "Rep. no Consultório".
// Com { test: true } envia um push de teste só para os aparelhos de quem chamou.
//
// Secrets necessários (npx supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:voce@dominio.com)
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem por padrão.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const TITLES: Record<string, string> = {
  ultimo_paciente: '🔴 Último paciente',
  representante_no_consultorio: '👤 Representante no consultório',
};

// Mesmo critério do app (utils.ts → cityKey)
function cityKey(city: string): string {
  return (city || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendAll(admin, subs: Sub[], payload: string, ttl: number) {
  let sent = 0;
  const stale: string[] = [];
  const errors: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          // urgency high: o Android entrega mesmo com o aparelho em economia de bateria
          { TTL: ttl, urgency: 'high' },
        );
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.id);
        else {
          console.error('push error', err?.statusCode, err?.body);
          errors.push(`${err?.statusCode ?? '?'}: ${String(err?.body ?? err?.message ?? '').slice(0, 120)}`);
        }
      }
    }),
  );
  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
  return { sent, removed: stale.length, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys not configured' }, 500);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC.trim(), VAPID_PRIVATE.trim());

  // Quem está chamando
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { doctor_id?: string; status_type?: string; test?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Teste: só para os aparelhos do próprio usuário ──
  if (body?.test) {
    const { data: mine } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user.id);
    const payload = JSON.stringify({
      title: '🔔 Teste de notificação',
      body: 'Se você está vendo isto, as notificações estão funcionando.',
      tag: `test:${user.id}`,
      url: '/',
    });
    return json(await sendAll(admin, mine ?? [], payload, 60));
  }

  const { doctor_id, status_type } = body ?? {};
  if (!doctor_id || !status_type || !(status_type in TITLES)) {
    return json({ error: 'invalid params' }, 400);
  }

  // Anti-spam: só notifica se este usuário marcou o status nos últimos 2 minutos.
  // Usa o horário do servidor (doctor_status_events), não o relógio do celular.
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: recent } = await admin
    .from('doctor_status_events')
    .select('id')
    .eq('doctor_id', doctor_id)
    .eq('status_type', status_type)
    .eq('created_by', user.id)
    .gte('event_at', since)
    .limit(1);
  if (!recent || recent.length === 0) return json({ sent: 0, reason: 'status not recent' });

  const { data: doctor } = await admin
    .from('doctors')
    .select('id, descricao, complemento, cidade')
    .eq('id', doctor_id)
    .maybeSingle();
  if (!doctor?.cidade) return json({ sent: 0, reason: 'doctor without city' });

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('city_key', cityKey(doctor.cidade))
    .neq('user_id', user.id);

  const payload = JSON.stringify({
    title: `${TITLES[status_type]} — ${doctor.descricao}`,
    body: [doctor.complemento, doctor.cidade].filter(Boolean).join(' · '),
    tag: `${doctor_id}:${status_type}`,
    url: '/',
  });

  // Mesma duração do status no app: Último Paciente 30 min, Rep. no Consultório 10 min
  const ttl = status_type === 'ultimo_paciente' ? 1800 : 600;
  return json(await sendAll(admin, subs ?? [], payload, ttl));
});
