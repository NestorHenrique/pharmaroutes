-- ============================================================
-- v17 · Vários locais de atendimento por médico
-- (a tabela se chama doctor_places porque já existia outra, vazia e sem uso, chamada doctor_locations)
-- O que muda:
--   1. doctor_places: locais EXTRAS do médico (o endereço que já existe em doctors continua sendo o
--      "Local 1", principal). Cada local extra tem endereço, GPS e a própria agenda (dia + turno).
--   2. doctor_statuses.location_id: em qual local o representante estava ao marcar o status
--      (vazio = local principal).
-- Na rota de um dia, vale o local extra que atende naquele dia; sem local extra no dia, vale o principal.
-- Pode rodar mais de uma vez.
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_places (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL DEFAULT '',   -- nome da clínica / hospital
  endereco    TEXT NOT NULL DEFAULT '',
  numero      TEXT NOT NULL DEFAULT '',
  bairro      TEXT NOT NULL DEFAULT '',
  cidade      TEXT NOT NULL DEFAULT '',
  map_link    TEXT NOT NULL DEFAULT '',
  agenda      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ "day": "qui", "shift": "TARDE" }]
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctor_places_doctor_idx ON doctor_places (doctor_id);

ALTER TABLE doctor_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doctor_places_all ON doctor_places;
CREATE POLICY doctor_places_all ON doctor_places FOR ALL TO authenticated USING (true) WITH CHECK (true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON doctor_places FROM anon'; END IF;
END $$;

ALTER TABLE doctor_statuses ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES doctor_places(id) ON DELETE SET NULL;
