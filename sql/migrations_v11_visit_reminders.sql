-- ============================================================
-- PharmaRoutes v11 — Lembrete "Já visitou?" (push quando o status vence)
-- Rode no Supabase SQL Editor DEPOIS do migrations_v9.sql. Pode rodar mais de uma vez.
--
-- O app já pergunta "Já visitou?" ao abrir (não precisa de nada do banco para isso).
-- Este arquivo liga o AVISO NO CELULAR (push) no minuto em que o status vence. O aviso se repete
-- a cada 5 minutos até a pessoa responder no app (por até 1 hora depois do vencimento).
--
-- Também é preciso publicar a função:  npx supabase functions deploy visit-reminder --no-verify-jwt
-- (e as chaves VAPID, as mesmas da função notify-city).
-- ============================================================

-- 1. Marca quando o último lembrete foi enviado (é daqui que se contam os 5 minutos).
--    Se o status for remarcado, expires_at passa a ser maior que reminded_at e o lembrete volta a valer.
ALTER TABLE doctor_statuses ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS doctor_statuses_reminder_idx
  ON doctor_statuses (expires_at)
  WHERE status_type IN ('representante_no_consultorio', 'aguardando_medico', 'ultimo_paciente');

-- 2. Segredo do agendamento: gerado aqui no banco, numa tabela que o app não consegue ler
--    (RLS ligada, sem política, sem permissão). Só a função (service role) e o pg_cron leem.
CREATE TABLE IF NOT EXISTS app_secrets (
  name  TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_secrets FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON app_secrets FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON app_secrets FROM authenticated'; END IF;
END $$;

INSERT INTO app_secrets (name, value)
VALUES ('visit_reminder_cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

-- 3. Extensões do agendamento (no Supabase também dá para ligar em Database > Extensions)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

NOTIFY pgrst, 'reload schema';

-- 4. Agenda: a cada minuto chama a função visit-reminder (rode DEPOIS de publicar a função).
--    Para desligar:  SELECT cron.unschedule('visit-reminders');
SELECT cron.schedule(
  'visit-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://mjqtfuhgkwgnqfggtszz.supabase.co/functions/v1/visit-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.app_secrets WHERE name = 'visit_reminder_cron')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
