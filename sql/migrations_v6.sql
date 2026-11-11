-- ============================================================
-- PharmaRoutes v6 — Migrations
-- Rode no Supabase SQL Editor DEPOIS do migrations_v4.sql.
-- Pode rodar mais de uma vez sem quebrar nada.
--
-- O que muda:
--   1. doctors ganha RQE e "cadastrado por" (created_by_name)
--   2. doctor_audit_logs: histórico de edições e log de exclusões (com cópia do médico excluído)
--   3. Eventos de horário passam a usar o horário real do clique (necessário para o modo offline)
-- ============================================================

-- 1. Novos campos em doctors
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS rqe             TEXT,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- 2. Histórico de edições e log de exclusões
--    Sem FOREIGN KEY de propósito: o registro sobrevive à exclusão do médico.
--    UPDATE  -> changes = { "campo": { "de": ..., "para": ... } }
--    DELETE  -> changes = cópia completa da linha excluída (exclusão "suave": dá para restaurar)
--    INSERT  -> só cadastros feitos em campo (created_via = 'APP_FIELD'); importações não entram
CREATE TABLE IF NOT EXISTS doctor_audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  doctor_id   UUID,
  doctor_name TEXT,
  action      TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id    UUID,
  actor_name  TEXT,
  changes     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctor_audit_logs_doctor_idx ON doctor_audit_logs (doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS doctor_audit_logs_action_idx ON doctor_audit_logs (action, created_at DESC);

ALTER TABLE doctor_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doctor_audit_logs_read ON doctor_audit_logs;
CREATE POLICY doctor_audit_logs_read ON doctor_audit_logs
  FOR SELECT TO authenticated USING (true);
-- Sem policy de INSERT/UPDATE/DELETE: ninguém pelo app mexe no log, só o gatilho abaixo (SECURITY DEFINER)
GRANT SELECT ON doctor_audit_logs TO authenticated;
-- O Supabase concede ALL por padrão em tabelas novas; aqui só leitura (RLS já bloquearia, isto é cinto e suspensório)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON doctor_audit_logs FROM authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON doctor_audit_logs FROM anon';
  END IF;
END $$;

-- Quem fez: o nome vem do servidor (perfil do representante ou o começo do e-mail), não do aparelho.
CREATE OR REPLACE FUNCTION audit_actor_name(p_uid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(display_name), '') FROM rep_profiles WHERE user_id = p_uid),
    (SELECT split_part(email, '@', 1) FROM auth.users WHERE id = p_uid),
    'sistema'
  );
$$;

CREATE OR REPLACE FUNCTION log_doctor_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid     UUID := auth.uid();
  actor   TEXT := audit_actor_name(auth.uid());
  diff    JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO doctor_audit_logs (doctor_id, doctor_name, action, actor_id, actor_name, changes)
    VALUES (OLD.id, OLD.descricao, 'DELETE', uid, actor, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_via = 'APP_FIELD' THEN
      INSERT INTO doctor_audit_logs (doctor_id, doctor_name, action, actor_id, actor_name, changes)
      VALUES (
        NEW.id, NEW.descricao, 'INSERT', uid, COALESCE(NEW.created_by_name, actor),
        jsonb_build_object('crm', NEW.crm, 'uf', NEW.uf, 'cidade', NEW.cidade)
      );
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: só os campos que mudaram (ignora os que o próprio app carimba a cada gravação)
  SELECT jsonb_object_agg(n.key, jsonb_build_object('de', o.value, 'para', n.value))
    INTO diff
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
   WHERE n.value IS DISTINCT FROM o.value
     AND n.key NOT IN ('updated_at', 'updated_by', 'updated_by_name', 'change_source');

  IF diff IS NOT NULL THEN
    INSERT INTO doctor_audit_logs (doctor_id, doctor_name, action, actor_id, actor_name, changes)
    VALUES (NEW.id, NEW.descricao, 'UPDATE', uid, COALESCE(NULLIF(btrim(NEW.updated_by_name), ''), actor), diff);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctors_audit ON doctors;
CREATE TRIGGER doctors_audit
  AFTER INSERT OR UPDATE OR DELETE ON doctors
  FOR EACH ROW EXECUTE FUNCTION log_doctor_audit();

-- Para restaurar um médico excluído (troque 123 pelo id da linha DELETE em doctor_audit_logs):
--   INSERT INTO doctors
--   SELECT (jsonb_populate_record(NULL::doctors, changes)).*
--     FROM doctor_audit_logs WHERE id = 123 AND action = 'DELETE';
-- (status, ordem da rota e carteira ligados ao médico não voltam: foram apagados junto.)

-- 3. Horário dos eventos: usa o horário do clique quando é confiável.
--    Sem isto, um status marcado sem internet seria gravado com a hora em que o celular
--    reconectou e a média de horários ficaria errada. Horário fora de [-12 h, +2 min] vira "agora".
CREATE OR REPLACE FUNCTION log_doctor_status_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_type IN ('ultimo_paciente', 'representante_no_consultorio', 'aguardando_medico', 'finalizou_atendimento')
     AND (TG_OP = 'INSERT' OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    INSERT INTO doctor_status_events (doctor_id, status_type, created_by, event_at)
    VALUES (
      NEW.doctor_id,
      NEW.status_type,
      NEW.created_by,
      CASE
        WHEN NEW.created_at BETWEEN now() - interval '12 hours' AND now() + interval '2 minutes' THEN NEW.created_at
        ELSE now()
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Atualiza o cache da API
NOTIFY pgrst, 'reload schema';

-- 5. Conferência
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'doctors'
   AND column_name IN ('rqe', 'created_by_name')
 ORDER BY column_name;
