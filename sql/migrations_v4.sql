-- ============================================================
-- PharmaRoutes v4 — Migrations
-- Rode no Supabase SQL Editor DEPOIS do migrations_v3.sql.
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================

-- Extensão para remover acentos (já disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Status: "Saiu do Setor" vira "Finalizou o Atendimento" + novo "Aguardando Médico"
ALTER TABLE doctor_statuses DROP CONSTRAINT IF EXISTS doctor_statuses_status_type_check;

-- Quem estava com "Saiu do Setor" passa para "Finalizou o Atendimento", válido até a meia-noite de hoje
UPDATE doctor_statuses
   SET status_type = 'finalizou_atendimento',
       expires_at  = (date_trunc('day', now() AT TIME ZONE 'America/Fortaleza') + interval '1 day' - interval '1 second')
                     AT TIME ZONE 'America/Fortaleza'
 WHERE status_type = 'saiu_do_setor';

ALTER TABLE doctor_statuses ADD CONSTRAINT doctor_statuses_status_type_check
  CHECK (status_type IN (
    'ultimo_paciente',
    'representante_no_consultorio',
    'aguardando_medico',
    'nao_veio_hoje',
    'finalizou_atendimento',
    'ferias',
    'viajando',
    'visitado_hoje'
  ));

-- 2. Realtime: mudanças em doctor_statuses chegam na hora para todos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'doctor_statuses'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE doctor_statuses;
  END IF;
END $$;
-- Necessário para o app saber qual médico/status foi removido num DELETE
ALTER TABLE doctor_statuses REPLICA IDENTITY FULL;

-- 3. Histórico de horários (base da média móvel)
--    Cada clique em Último Paciente / Rep. no Consultório / Aguardando / Finalizou
--    grava o horário do servidor aqui, mesmo quando o status é remarcado.
CREATE TABLE IF NOT EXISTS doctor_status_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  status_type TEXT NOT NULL,
  event_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT
);
CREATE INDEX IF NOT EXISTS doctor_status_events_event_at_idx ON doctor_status_events (event_at DESC);
CREATE INDEX IF NOT EXISTS doctor_status_events_doctor_idx   ON doctor_status_events (doctor_id, event_at DESC);

ALTER TABLE doctor_status_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doctor_status_events_read ON doctor_status_events;
CREATE POLICY doctor_status_events_read ON doctor_status_events
  FOR SELECT TO authenticated USING (true);
-- Sem policy de INSERT: só o trigger abaixo grava (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION log_doctor_status_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_type IN ('ultimo_paciente', 'representante_no_consultorio', 'aguardando_medico', 'finalizou_atendimento')
     AND (TG_OP = 'INSERT' OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    INSERT INTO doctor_status_events (doctor_id, status_type, created_by)
    VALUES (NEW.doctor_id, NEW.status_type, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctor_statuses_log ON doctor_statuses;
CREATE TRIGGER doctor_statuses_log
  AFTER INSERT OR UPDATE ON doctor_statuses
  FOR EACH ROW EXECUTE FUNCTION log_doctor_status_event();

-- 4. Ordem manual da rota, por representante e por dia
CREATE TABLE IF NOT EXISTS rep_route_order (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  doctor_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE rep_route_order ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rep_route_order_own ON rep_route_order;
CREATE POLICY rep_route_order_own ON rep_route_order
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Unifica grafias de cidade ("Parnaiba" → "Parnaíba")
--    Fica a grafia mais usada; em empate, a com acento.
--    O trigger de updated_at é pausado para o selo "Atualizado por" não mudar.
DO $$
DECLARE
  has_trigger BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'doctors_updated_at' AND tgrelid = 'doctors'::regclass
  ) INTO has_trigger;

  IF has_trigger THEN
    ALTER TABLE doctors DISABLE TRIGGER doctors_updated_at;
  END IF;

  WITH v AS (
    SELECT regexp_replace(btrim(cidade), '\s+', ' ', 'g')                     AS cidade,
           lower(unaccent(regexp_replace(btrim(cidade), '\s+', ' ', 'g')))     AS k,
           count(*)                                                            AS n
      FROM doctors
     WHERE nullif(btrim(cidade), '') IS NOT NULL
     GROUP BY 1, 2
  ), best AS (
    SELECT DISTINCT ON (k) k, cidade
      FROM v
     ORDER BY k, n DESC, (cidade <> unaccent(cidade)) DESC, cidade
  )
  UPDATE doctors d
     SET cidade = b.cidade
    FROM best b
   WHERE nullif(btrim(d.cidade), '') IS NOT NULL
     AND lower(unaccent(regexp_replace(btrim(d.cidade), '\s+', ' ', 'g'))) = b.k
     AND d.cidade IS DISTINCT FROM b.cidade;

  IF has_trigger THEN
    ALTER TABLE doctors ENABLE TRIGGER doctors_updated_at;
  END IF;
END $$;

-- 6. Atualiza o cache da API
NOTIFY pgrst, 'reload schema';

-- 7. Resultado: cidades depois da unificação
SELECT cidade, count(*) AS medicos
  FROM doctors
 WHERE nullif(btrim(cidade), '') IS NOT NULL
 GROUP BY cidade
 ORDER BY cidade;
