// @ts-nocheck — Supabase Edge Function (Deno). Fica fora do build do Next.
//
// Envia Web Push para os representantes inscritos na cidade do médico quando
// alguém marca "Último Paciente" ou "Rep. no Consultório".
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
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // Quem está chamando
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { doctor_id?: string; status_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid body' }, 400);
  }
  const { doctor_id, status_type } = body ?? {};
  if (!doctor_id || !status_type || !(status_type in TITLES)) {
    return json({ error: 'invalid params' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Anti-spam: só notifica status marcado por este usuário nos últimos 2 minutos
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: status } = await admin
    .from('doctor_statuses')
    .select('created_at, created_by')
    .eq('doctor_id', doctor_id)
    .eq('status_type', status_type)
    .gte('created_at', since)
    .maybeSingle();
  if (!status || status.created_by !== user.id) {
    return json({ sent: 0, reason: 'status not recent' });
  }

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

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: status_type === 'ultimo_paciente' ? 1200 : 600 },
        );
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.id);
        else console.error('push error', err?.statusCode, err?.body);
      }
    }),
  );

  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);

  return json({ sent, removed: stale.length });
});
