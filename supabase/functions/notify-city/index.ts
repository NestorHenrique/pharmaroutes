// @ts-nocheck — Supabase Edge Function (Deno). Fica fora do build do Next.
//
// Envia Web Push para os representantes que recebem avisos da cidade do médico quando
// alguém marca "Último Paciente" ou "Rep. no Consultório".
//
// Quem recebe (migração v12):
//   - o representante que tem a SEMANA ATIVA desta segunda-feira (rep_profiles.active_week) E cidades salvas
//     para ela (rep_week_cities) recebe se a cidade do médico está nessa lista;
//   - quem não escolheu cidades da semana continua como antes: a cidade da inscrição do aparelho;
//   - rep_profiles.notify_enabled = false desliga os avisos.
// Sem a migração v12, tudo funciona como antes.
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

/** Segunda-feira de hoje no horário do Brasil (UTC-3), como "aaaa-mm-dd" (a semana ativa vale só nela) */
function mondayInBrazil(): string {
  const d = new Date(Date.now() - 3 * 3600_000); // lê os campos UTC como se fossem os de Brasília
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

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

  let body: { doctor_id?: string; status_type?: string; test?: boolean; location_id?: string | null; fix?: boolean };
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

  const { doctor_id, status_type, location_id, fix } = body ?? {};
  if (!doctor_id || !status_type || !(status_type in TITLES)) {
    return json({ error: 'invalid params' }, 400);
  }

  // Anti-spam: só notifica se este usuário marcou (ou corrigiu) o status nos últimos 2 minutos.
  // Usa o horário do servidor (doctor_status_events), não o relógio do celular.
  // Na correção de local o horário do status NÃO renova, então vale um status ativo do usuário.
  if (fix) {
    const { data: active } = await admin
      .from('doctor_statuses')
      .select('id')
      .eq('doctor_id', doctor_id)
      .eq('status_type', status_type)
      .eq('created_by', user.id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1);
    if (!active || active.length === 0) return json({ sent: 0, reason: 'no active status' });
  } else {
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
  }

  const { data: doctor } = await admin
    .from('doctors')
    .select('id, descricao, complemento, cidade')
    .eq('id', doctor_id)
    .maybeSingle();
  if (!doctor) return json({ sent: 0, reason: 'doctor not found' });

  // Médico com 2+ locais: o aviso diz o local e vale a cidade DELE (local extra em doctor_places)
  let placeName = '';
  let city = doctor.cidade ?? '';
  if (location_id) {
    const { data: place } = await admin
      .from('doctor_places')
      .select('nome, cidade')
      .eq('id', location_id)
      .eq('doctor_id', doctor_id)
      .maybeSingle();
    if (place) {
      placeName = place.nome ?? '';
      city = place.cidade || city;
    }
  } else if (doctor.complemento) {
    // sem location_id: Local 1 (principal); só cita o local se o médico tem outros
    const { count } = await admin.from('doctor_places').select('id', { count: 'exact', head: true }).eq('doctor_id', doctor_id);
    if ((count ?? 0) > 0) placeName = doctor.complemento;
  }
  if (!city) return json({ sent: 0, reason: 'doctor without city' });

  const key = cityKey(city);
  const { data: allSubs } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, city_key')
    .neq('user_id', user.id);

  // Semana ativa e cidades da semana de cada representante (ausentes antes da migração v12: erro = usa o modo antigo)
  const monday = mondayInBrazil();
  const [{ data: profs, error: profErr }, { data: weekRows, error: weekErr }] = await Promise.all([
    admin.from('rep_profiles').select('user_id, active_week, active_week_monday, notify_enabled'),
    admin.from('rep_week_cities').select('user_id, week, cities'),
  ]);
  const profOf = new Map((profErr ? [] : profs ?? []).map((p) => [p.user_id, p]));
  const citiesOf = new Map((weekErr ? [] : weekRows ?? []).map((r) => [`${r.user_id}:${r.week}`, (r.cities ?? []) as string[]]));

  const subs = (allSubs ?? []).filter((s) => {
    const p = profOf.get(s.user_id);
    if (p && p.notify_enabled === false) return false;
    const weekCities =
      p && p.active_week && p.active_week_monday === monday ? citiesOf.get(`${s.user_id}:${p.active_week}`) : undefined;
    if (weekCities && weekCities.length > 0) return weekCities.includes(key);
    return s.city_key === key; // sem cidades da semana: a cidade do aparelho, como antes
  });

  const who = (await admin.from('rep_profiles').select('display_name').eq('user_id', user.id).maybeSingle()).data?.display_name;
  const title = fix
    ? `Local corrigido${placeName ? ` · ${placeName}` : ''}`
    : `${TITLES[status_type]}${placeName ? ` · ${placeName}` : ''}`;
  const bodyText = fix
    ? `${who ? `${who} está` : 'Está'} com ${doctor.descricao}${placeName ? ` no ${placeName}` : ''} · ${city}`
    : `${who ? `${who} está com ` : ''}${doctor.descricao} · ${city}`;
  const payload = JSON.stringify({
    title,
    body: bodyText,
    tag: `${doctor_id}:${status_type}`,
    url: '/',
  });

  // Mesma duração do status no app: Último Paciente 30 min, Rep. no Consultório 10 min
  const ttl = status_type === 'ultimo_paciente' ? 1800 : 600;
  return json(await sendAll(admin, subs ?? [], payload, ttl));
});
