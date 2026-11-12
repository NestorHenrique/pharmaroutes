-- ============================================================
-- PharmaRoutes v14 — Termos de uso (LGPD) e aprovação de edições de dados compartilhados
-- Pode rodar mais de uma vez sem quebrar nada. Aditivo.
--
--   1. rep_profiles: aceite dos termos (terms_accepted_at, terms_version)
--   2. doctor_edit_proposals: mudar NOME, CRM, UF ou ESPECIALIDADE de um médico vira uma proposta.
--      Outro representante aprova ou recusa; quem propôs pode cancelar.
--      Sem decisão em 24 h a mudança vale sozinha (o app nunca trava se o colega não abrir).
--      Telefone, endereço, agenda etc. continuam editáveis direto (ficam no histórico de edições).
-- ============================================================

-- 1. Termos
ALTER TABLE rep_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version     TEXT;

-- 2. Propostas
CREATE TABLE IF NOT EXISTS doctor_edit_proposals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id        UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  proposed_by      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_by_name TEXT,
  changes          JSONB NOT NULL,  -- {"crm": {"de": "8786", "para": "8787"}}
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by       UUID,
  decided_by_name  TEXT,
  decided_at       TIMESTAMPTZ,
  auto_applied     BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doctor_edit_proposals_status_idx ON doctor_edit_proposals (status, created_at);
CREATE INDEX IF NOT EXISTS doctor_edit_proposals_doctor_idx ON doctor_edit_proposals (doctor_id);

ALTER TABLE doctor_edit_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS doctor_edit_proposals_read   ON doctor_edit_proposals;
DROP POLICY IF EXISTS doctor_edit_proposals_insert ON doctor_edit_proposals;
CREATE POLICY doctor_edit_proposals_read   ON doctor_edit_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY doctor_edit_proposals_insert ON doctor_edit_proposals FOR INSERT TO authenticated WITH CHECK (proposed_by = auth.uid() AND status = 'pending');
-- Sem política de UPDATE/DELETE: só as funções abaixo decidem
REVOKE ALL ON doctor_edit_proposals FROM PUBLIC;
GRANT SELECT, INSERT ON doctor_edit_proposals TO authenticated;

-- Realtime (as propostas aparecem para o colega na hora)
ALTER TABLE doctor_edit_proposals REPLICA IDENTITY FULL;

-- Aplica uma proposta no médico (só os 4 campos permitidos)
CREATE OR REPLACE FUNCTION _apply_doctor_edit(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c JSONB;
  did UUID;
BEGIN
  SELECT changes, doctor_id INTO c, did FROM doctor_edit_proposals WHERE id = p_id;
  UPDATE doctors d SET
    descricao     = CASE WHEN c ? 'descricao'     THEN COALESCE(c->'descricao'->>'para', d.descricao) ELSE d.descricao END,
    crm           = CASE WHEN c ? 'crm'           THEN COALESCE(c->'crm'->>'para', d.crm) ELSE d.crm END,
    uf            = CASE WHEN c ? 'uf'            THEN COALESCE(c->'uf'->>'para', d.uf) ELSE d.uf END,
    especialidade = CASE WHEN c ? 'especialidade' THEN c->'especialidade'->>'para' ELSE d.especialidade END
  WHERE d.id = did;
END;
$$;
REVOKE ALL ON FUNCTION _apply_doctor_edit(UUID) FROM PUBLIC;

-- Aprovar / recusar (quem propôs só pode cancelar a própria). Devolve: approved | rejected | cancelled |
-- conflict (CRM já existe) | own | already_decided | not_found | unauthorized
CREATE OR REPLACE FUNCTION decide_doctor_edit(p_id UUID, p_approve BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r  doctor_edit_proposals;
  me UUID := auth.uid();
  who TEXT;
BEGIN
  IF me IS NULL THEN RETURN 'unauthorized'; END IF;
  SELECT * INTO r FROM doctor_edit_proposals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF r.status <> 'pending' THEN RETURN 'already_decided'; END IF;
  who := COALESCE(audit_actor_name(me), 'colega');

  IF p_approve THEN
    IF r.proposed_by = me THEN RETURN 'own'; END IF;
    BEGIN
      PERFORM _apply_doctor_edit(p_id);
    EXCEPTION WHEN unique_violation THEN
      UPDATE doctor_edit_proposals SET status = 'rejected', decided_by = me, decided_by_name = who, decided_at = now() WHERE id = p_id;
      RETURN 'conflict';
    END;
    UPDATE doctor_edit_proposals SET status = 'approved', decided_by = me, decided_by_name = who, decided_at = now() WHERE id = p_id;
    RETURN 'approved';
  END IF;

  UPDATE doctor_edit_proposals
     SET status = CASE WHEN r.proposed_by = me THEN 'cancelled' ELSE 'rejected' END,
         decided_by = me, decided_by_name = who, decided_at = now()
   WHERE id = p_id;
  RETURN CASE WHEN r.proposed_by = me THEN 'cancelled' ELSE 'rejected' END;
END;
$$;
REVOKE ALL ON FUNCTION decide_doctor_edit(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decide_doctor_edit(UUID, BOOLEAN) TO authenticated;

-- Sem decisão em 24 h: vale sozinha (rodada de hora em hora pelo pg_cron)
CREATE OR REPLACE FUNCTION auto_apply_doctor_edits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r doctor_edit_proposals;
  n INTEGER := 0;
BEGIN
  FOR r IN SELECT * FROM doctor_edit_proposals WHERE status = 'pending' AND created_at < now() - interval '24 hours' FOR UPDATE SKIP LOCKED LOOP
    BEGIN
      PERFORM _apply_doctor_edit(r.id);
      UPDATE doctor_edit_proposals SET status = 'approved', auto_applied = true, decided_at = now(), decided_by_name = 'automático (24 h)' WHERE id = r.id;
      n := n + 1;
    EXCEPTION WHEN unique_violation THEN
      UPDATE doctor_edit_proposals SET status = 'rejected', decided_at = now(), decided_by_name = 'automático (CRM já existe)' WHERE id = r.id;
    END;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION auto_apply_doctor_edits() FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('doctor-edit-autoapply') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'doctor-edit-autoapply');
    PERFORM cron.schedule('doctor-edit-autoapply', '7 * * * *', 'SELECT public.auto_apply_doctor_edits()');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
