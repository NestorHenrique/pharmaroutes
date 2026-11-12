-- ============================================================
-- PharmaRoutes v12 — Cidades por semana, semana ativa e primeiro acesso
-- Rode no Supabase SQL Editor. Pode rodar mais de uma vez sem quebrar nada.
-- Aditivo: só cria tabela e colunas novas. O app funciona antes e depois dela
-- (sem ela, usa a cópia guardada no aparelho).
--
--   1. rep_week_cities: as cidades de cada semana do ciclo, POR representante
--      (usadas para decidir quem recebe aviso de Último paciente / Rep. no consultório)
--   2. rep_profiles ganha:
--        name_confirmed_at  "Confirme como os colegas te chamam" (primeiro acesso)
--        tour_seen_at       tutorial da tela inicial já visto
--        notify_enabled     interruptor "Receber avisos dos colegas"
--        active_week        semana do ciclo em que o representante está esta semana
--        active_week_monday segunda-feira a que active_week se refere (vale só nessa semana)
-- ============================================================

-- 1. Cidades por semana e por representante (guarda a chave da cidade: "parnaiba", "luzilandia"...)
CREATE TABLE IF NOT EXISTS rep_week_cities (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week       SMALLINT NOT NULL CHECK (week BETWEEN 1 AND 5),
  cities     TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week)
);

ALTER TABLE rep_week_cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rep_week_cities_own ON rep_week_cities;
CREATE POLICY rep_week_cities_own ON rep_week_cities
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON rep_week_cities TO authenticated;

-- 2. Perfil
ALTER TABLE rep_profiles
  ADD COLUMN IF NOT EXISTS name_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tour_seen_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_enabled     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS active_week        SMALLINT CHECK (active_week BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS active_week_monday DATE;

-- Quem já tinha nome no perfil não precisa confirmar de novo
UPDATE rep_profiles
   SET name_confirmed_at = now()
 WHERE name_confirmed_at IS NULL AND COALESCE(btrim(display_name), '') <> '';

NOTIFY pgrst, 'reload schema';
