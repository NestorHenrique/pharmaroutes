-- ============================================================
-- PharmaRoutes v9 — Histórico de status (quem, data e hora)
-- Rode no Supabase SQL Editor DEPOIS do migrations_v8.sql.
-- Pode rodar mais de uma vez sem quebrar nada.
--
-- O que muda:
--   1. doctor_status_events ganha o nome do representante (rep_name) e a data de retorno
--      (Licença/Viagem), para a ficha do médico e a tela geral de Status mostrarem
--      "No consultório · Arthur · 10/11 13:19" mesmo depois que o status expira.
--   2. O gatilho passa a registrar TODOS os status (menos "visitado_hoje", que tem a
--      tabela doctor_visits). A média de horários continua usando só os 4 de antes:
--      o app filtra por tipo.
--   3. Aproveita os status já marcados que ainda não estavam no histórico.
-- ============================================================

-- 1. Colunas novas
ALTER TABLE doctor_status_events
  ADD COLUMN IF NOT EXISTS rep_name    TEXT,
  ADD COLUMN IF NOT EXISTS return_date DATE;

-- 2. Gatilho: registra todos os status, com nome e data de retorno
CREATE OR REPLACE FUNCTION log_doctor_status_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_type <> 'visitado_hoje'
     AND (TG_OP = 'INSERT' OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    INSERT INTO doctor_status_events (doctor_id, status_type, created_by, rep_name, return_date, event_at)
    VALUES (
      NEW.doctor_id,
      NEW.status_type,
      NEW.created_by,
      NULLIF(btrim(COALESCE(NEW.rep_name, '')), ''),
      NEW.return_date,
      -- Horário do clique quando é confiável (status marcado sem internet sobe depois)
      CASE
        WHEN NEW.created_at BETWEEN now() - interval '12 hours' AND now() + interval '2 minutes' THEN NEW.created_at
        ELSE now()
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctor_statuses_log ON doctor_statuses;
CREATE TRIGGER doctor_statuses_log
  AFTER INSERT OR UPDATE ON doctor_statuses
  FOR EACH ROW EXECUTE FUNCTION log_doctor_status_event();

-- 3a. Nome nos eventos antigos: do status de origem ou do perfil do representante
UPDATE doctor_status_events e
   SET rep_name = s.rep_name
  FROM doctor_statuses s
 WHERE e.rep_name IS NULL
   AND s.doctor_id = e.doctor_id
   AND s.status_type = e.status_type
   AND s.created_by = e.created_by
   AND NULLIF(btrim(COALESCE(s.rep_name, '')), '') IS NOT NULL;

UPDATE doctor_status_events e
   SET rep_name = p.display_name
  FROM rep_profiles p
 WHERE e.rep_name IS NULL
   AND p.user_id::text = e.created_by
   AND NULLIF(btrim(COALESCE(p.display_name, '')), '') IS NOT NULL;

-- 3b. Status já marcados que ainda não estavam no histórico (Licença, Viagem, Não veio, Finalizou...)
INSERT INTO doctor_status_events (doctor_id, status_type, created_by, rep_name, return_date, event_at)
SELECT s.doctor_id, s.status_type, s.created_by, NULLIF(btrim(COALESCE(s.rep_name, '')), ''), s.return_date, s.created_at
  FROM doctor_statuses s
 WHERE s.status_type <> 'visitado_hoje'
   AND s.created_at IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM doctor_status_events e
      WHERE e.doctor_id = s.doctor_id
        AND e.status_type = s.status_type
        AND abs(extract(epoch FROM (e.event_at - s.created_at))) < 120
   );

-- Leitura continua liberada só para logados; gravar, só o gatilho
GRANT SELECT ON doctor_status_events TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- PharmaRoutes v10 — Completa o DDD 86 nos WhatsApps do médico salvos sem DDD
-- Rode no Supabase SQL Editor (depois do migrations_v9.sql). Pode rodar mais de uma vez.
--
--   9 dígitos começando com 9  (999999999)  -> 86 + número       (86999999999)
--   8 dígitos começando com 9  (99999999)   -> 86 + 9 + número   (86999999999), celular antigo sem o 9 extra
--   Fixos (8 dígitos começando com 2 ou 3) e outros casos ficam como estão.
--   O valor antigo fica no histórico de edições (doctor_audit_logs).
-- ============================================================

UPDATE doctors
   SET whatsapp_medico = CASE
         WHEN regexp_replace(whatsapp_medico, '\D', '', 'g') ~ '^9\d{8}$' THEN '86' || regexp_replace(whatsapp_medico, '\D', '', 'g')
         ELSE '869' || regexp_replace(whatsapp_medico, '\D', '', 'g')
       END
 WHERE regexp_replace(COALESCE(whatsapp_medico, ''), '\D', '', 'g') ~ '^9\d{7,8}$';

UPDATE doctors
   SET whatsapp_clinica = CASE
         WHEN regexp_replace(whatsapp_clinica, '\D', '', 'g') ~ '^9\d{8}$' THEN '86' || regexp_replace(whatsapp_clinica, '\D', '', 'g')
         ELSE '869' || regexp_replace(whatsapp_clinica, '\D', '', 'g')
       END
 WHERE regexp_replace(COALESCE(whatsapp_clinica, ''), '\D', '', 'g') ~ '^9\d{7,8}$';
