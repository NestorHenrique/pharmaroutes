-- v5: ciclo de 5 semanas + "Marcar Visitado" por representante
-- Rodar no SQL Editor do Supabase. Idempotente.

-- 1. Semanas do ciclo (1..5) em que o médico entra na rota
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS cycle_weeks SMALLINT[] NOT NULL DEFAULT '{}';

ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_cycle_weeks_range;
ALTER TABLE doctors ADD CONSTRAINT doctors_cycle_weeks_range
  CHECK (cycle_weeks <@ ARRAY[1, 2, 3, 4, 5]::SMALLINT[]);

-- 2. Visitas do ciclo: uma linha por (representante, médico).
--    "Renovar Ciclo" apaga só as linhas do próprio representante;
--    semanas, ordem manual (rep_route_order) e dados do médico ficam intactos.
CREATE TABLE IF NOT EXISTS rep_cycle_visits (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id  UUID NOT NULL REFERENCES doctors(id)    ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'visitado' CHECK (status = 'visitado'),
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doctor_id)
);

ALTER TABLE rep_cycle_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rep_cycle_visits_own ON rep_cycle_visits;
CREATE POLICY rep_cycle_visits_own ON rep_cycle_visits
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
