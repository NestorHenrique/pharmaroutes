-- ============================================================
-- PharmaRoutes v11 — Lembrete "Já visitou?" (push quando o status vence)
-- Rode no Supabase SQL Editor DEPOIS do migrations_v9.sql. Pode rodar mais de uma vez.
--
-- O app já pergunta "Já visitou?" ao abrir (não precisa de nada do banco para isso).
-- Este arquivo liga o AVISO NO CELULAR (push) no minuto em que o status vence.
--
-- PASSOS (nesta ordem):
--   1. Rode a PARTE 1 abaixo.
--   2. Publique a função:   npx supabase functions deploy visit-reminder --no-verify-jwt
--                           npx supabase secrets set CRON_SECRET="um-texto-longo-so-seu"
--   3. Em Database > Extensions, habilite  pg_cron  e  pg_net.
--   4. Troque <CRON_SECRET> na PARTE 2 pelo mesmo texto do passo 2 e rode a PARTE 2.
-- ============================================================

-- ── PARTE 1 ─────────────────────────────────────────────────
-- Marca quando o lembrete daquele vencimento já foi enviado (não manda duas vezes).
-- Se o status for remarcado, expires_at passa a ser maior que reminded_at e o lembrete volta a valer.
ALTER TABLE doctor_statuses ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS doctor_statuses_reminder_idx
  ON doctor_statuses (expires_at)
  WHERE status_type IN ('representante_no_consultorio', 'aguardando_medico', 'ultimo_paciente');

NOTIFY pgrst, 'reload schema';

-- ── PARTE 2 (rode só depois dos passos 2 e 3) ──────────────
-- A cada minuto chama a função visit-reminder.
--
-- SELECT cron.unschedule('visit-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'visit-reminders');
-- SELECT cron.schedule(
--   'visit-reminders',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://mjqtfuhgkwgnqfggtszz.supabase.co/functions/v1/visit-reminder',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--     body    := '{}'::jsonb,
--     timeout_milliseconds := 20000
--   );
--   $$
-- );
--
-- Para desligar:  SELECT cron.unschedule('visit-reminders');
