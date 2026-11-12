// @ts-nocheck — Supabase Edge Function (Deno). Fica fora do build do Next.
//
// "Já visitou?": a cada minuto (pg_cron, ver sql/migrations_v11_visit_reminders.sql) procura status
// do próprio representante que acabaram de vencer (Rep. no consultório 10 min; Aguardando e
// Último paciente 30 min) e manda um Web Push só para os aparelhos DELE: "Já visitou {médico}?".
// Ao abrir o app, a janela "Já visitou?" aparece e ele responde.
// O aviso se REPETE a cada 5 minutos enquanto não houver resposta (por até 1 hora depois do
// vencimento); responder no app (Sim ou Ainda não) apaga a pendência e o aviso para.
//
// Deploy:  npx supabase functions deploy visit-reminder --no-verify-jwt
// Segredo do agendamento: fica na tabela app_secrets (nome visit_reminder_cron), criada pelo
//          sql/migrations_v11_visit_reminders.sql; o pg_cron manda o mesmo valor no cabeçalho x-cron-secret.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (já usados pela notify-city)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem por padrão.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const LABELS: Record<string, string> = {
  representante_no_consultorio: 'Rep. no consultório',
  aguardando_medico: 'Aguardando médico',
  ultimo_paciente: 'Último paciente',
};
const STATUSES = Object.keys(LABELS);

/** Só lembra de status que venceram há pouco; depois disso o app continua perguntando ao abrir */
const MAX_AGE_MS = 60 * 60_000;
/** Repete o aviso a cada 5 min. 4,5 min de limite: a função roda a cada minuto, então cai nos 5 min certos */
const REPEAT_MS = 4.5 * 60_000;
/** O aparelho pode estar desligado/sem sinal: o push espera até 6 h */
const TTL_SECONDS = 6 * 60 * 60;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Só o agendamento do banco chama esta função: confere o segredo guardado em app_secrets
  const { data: secret } = await admin.from('app_secrets').select('value').eq('name', 'visit_reminder_cron').maybeSingle();
  const given = req.headers.get('x-cron-secret');
  if (!secret?.value || !given || given !== secret.value) return json({ error: 'unauthorized' }, 401);

  const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys not configured' }, 500);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC.trim(), VAPID_PRIVATE.trim());

  const now = Date.now();
  const { data: rows, error } = await admin
    .from('doctor_statuses')
    .select('id, doctor_id, status_type, created_at, expires_at, created_by, reminded_at')
    .in('status_type', STATUSES)
    .lte('expires_at', new Date(now).toISOString())
    .gte('expires_at', new Date(now - MAX_AGE_MS).toISOString())
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  // Sem lembrete ainda para ESTE vencimento (status remarcado: expires_at fica maior que reminded_at)
  // ou o último lembrete foi há 5 minutos ou mais
  const due = (rows ?? []).filter((r) => {
    if (!r.reminded_at || new Date(r.reminded_at) < new Date(r.expires_at)) return true;
    return now - new Date(r.reminded_at).getTime() >= REPEAT_MS;
  });
  if (due.length === 0) return json({ due: 0, sent: 0 });

  // Marca antes de enviar: duas execuções seguidas não mandam o mesmo lembrete duas vezes
  // (e é daqui que se conta os 5 minutos até o próximo)
  await admin.from('doctor_statuses').update({ reminded_at: new Date(now).toISOString() }).in('id', due.map((r) => r.id));

  const doctorIds = [...new Set(due.map((r) => r.doctor_id))];
  const userIds = [...new Set(due.map((r) => r.created_by))];

  const [{ data: doctors }, { data: visits }, { data: subs }] = await Promise.all([
    admin.from('doctors').select('id, descricao').in('id', doctorIds),
    admin.from('doctor_visits').select('doctor_id, user_id, visited_at').in('doctor_id', doctorIds).in('user_id', userIds),
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
  ]);

  const nameOf = new Map((doctors ?? []).map((d) => [d.id, d.descricao]));
  const visitedAt = new Map((visits ?? []).map((v) => [`${v.doctor_id}:${v.user_id}`, v.visited_at]));
  const subsOf = new Map<string, typeof subs>();
  for (const s of subs ?? []) subsOf.set(s.user_id, [...(subsOf.get(s.user_id) ?? []), s]);

  let sent = 0;
  let skipped = 0;
  const stale: string[] = [];

  for (const r of due) {
    // Quem já visitou depois de marcar o status não precisa de lembrete
    const v = visitedAt.get(`${r.doctor_id}:${r.created_by}`);
    if (v && new Date(v).getTime() >= new Date(r.created_at).getTime() - 60_000) {
      skipped++;
      continue;
    }
    const name = nameOf.get(r.doctor_id);
    if (!name) {
      skipped++;
      continue;
    }
    const payload = JSON.stringify({
      title: `Já visitou ${name}?`,
      body: `${LABELS[r.status_type]} terminou. Toque para responder.`,
      tag: `visit:${r.id}`,
      url: '/',
    });
    await Promise.all(
      (subsOf.get(r.created_by) ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: TTL_SECONDS, urgency: 'high' },
          );
          sent++;
        } catch (err) {
          if (err?.statusCode === 404 || err?.statusCode === 410) stale.push(s.id);
          else console.error('push error', err?.statusCode, err?.body);
        }
      }),
    );
  }

  if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
  return json({ due: due.length, sent, skipped, removed: stale.length });
});
