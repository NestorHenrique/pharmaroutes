-- ============================================================
-- PharmaRoutes v7 — Migrations
-- Rode no Supabase SQL Editor DEPOIS do migrations_v6.sql.
-- Pode rodar mais de uma vez sem quebrar nada.
--
-- O que muda:
--   1. doctors ganha WhatsApp do médico e WhatsApp da clínica
--   2. doctor_visits: a visita do ciclo passa a ser POR REPRESENTANTE
--      (antes era uma linha 'visitado_hoje' em doctor_statuses, e o último a clicar sobrescrevia)
--   3. rep_profiles ganha foto (avatar_url) e passa a ser legível por todos os logados
--      (para mostrar nome/foto de quem visitou o médico); só o dono altera o próprio perfil
-- ============================================================

-- 1. WhatsApps separados
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS whatsapp_medico  TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_clinica TEXT;

-- 2. Visitas por representante
--    "Renovar ciclo" apaga só as linhas do próprio representante; o histórico de horário
--    (doctor_status_events) não é tocado.
CREATE TABLE IF NOT EXISTS doctor_visits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL DEFAULT auth.uid(),
  rep_name   TEXT,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, user_id)
);
CREATE INDEX IF NOT EXISTS doctor_visits_user_idx ON doctor_visits (user_id);

ALTER TABLE doctor_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doctor_visits_read   ON doctor_visits;
DROP POLICY IF EXISTS doctor_visits_insert ON doctor_visits;
DROP POLICY IF EXISTS doctor_visits_update ON doctor_visits;
DROP POLICY IF EXISTS doctor_visits_delete ON doctor_visits;
CREATE POLICY doctor_visits_read   ON doctor_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY doctor_visits_insert ON doctor_visits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY doctor_visits_update ON doctor_visits FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY doctor_visits_delete ON doctor_visits FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_visits TO authenticated;

-- Realtime (DELETE precisa do REPLICA IDENTITY FULL para o filtro funcionar)
ALTER TABLE doctor_visits REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'doctor_visits'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE doctor_visits;
  END IF;
END $$;

-- Aproveita as visitas atuais (linhas 'visitado_hoje' persistentes, sem expiração) criadas por usuários que existem.
-- As linhas antigas em doctor_statuses NÃO são apagadas aqui: o app novo as ignora; limpe depois do deploy.
INSERT INTO doctor_visits (doctor_id, user_id, rep_name, visited_at)
SELECT s.doctor_id, u.id, s.rep_name, COALESCE(s.created_at, now())
FROM doctor_statuses s
JOIN auth.users u ON u.id::text = s.created_by
WHERE s.status_type = 'visitado_hoje' AND s.expires_at IS NULL
ON CONFLICT (doctor_id, user_id) DO NOTHING;

-- 3. Foto de perfil + leitura dos perfis
ALTER TABLE rep_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

DROP POLICY IF EXISTS rep_profiles_read_all ON rep_profiles;
CREATE POLICY rep_profiles_read_all ON rep_profiles FOR SELECT TO authenticated USING (true);
-- rep_profiles_own (ALL, só o dono) continua valendo para INSERT/UPDATE/DELETE
