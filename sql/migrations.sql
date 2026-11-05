-- ============================================================
-- PharmaRoutes v2 — Migrations
-- Execute no Supabase SQL Editor ANTES de testar as novas features
-- ============================================================

-- 1. Novos campos na tabela doctors
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS categoria    TEXT DEFAULT 'consultorio',
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
  ADD COLUMN IF NOT EXISTS change_source   TEXT DEFAULT 'manual';

-- 2. Tabela de status temporários
CREATE TABLE IF NOT EXISTS doctor_statuses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  status_type TEXT NOT NULL
    CHECK (status_type IN (
      'ultimo_paciente',
      'representante_no_consultorio',
      'nao_veio_hoje',
      'ferias',
      'viajando',
      'saiu_do_setor',
      'visitado_hoje'
    )),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  return_date DATE,
  rep_name    TEXT,
  created_by  TEXT,
  UNIQUE (doctor_id, status_type)
);

-- 3. RLS para doctor_statuses
ALTER TABLE doctor_statuses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'doctor_statuses' AND policyname = 'all_authenticated_statuses'
  ) THEN
    CREATE POLICY all_authenticated_statuses ON doctor_statuses
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Trigger para auto-update de updated_at em doctors
CREATE OR REPLACE FUNCTION update_doctors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS doctors_updated_at ON doctors;
CREATE TRIGGER doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION update_doctors_updated_at();
