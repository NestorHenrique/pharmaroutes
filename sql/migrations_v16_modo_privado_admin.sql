-- ============================================================
-- v16 · Modo privado do representante + administrador
-- O que muda:
--   1. rep_profiles.private_mode: com ele ligado, os colegas veem "Representante" (sem nome e sem foto).
--      O banco continua gravando o usuário real em tudo (created_by, actor_id, user_id...).
--   2. app_admins: quem é administrador. Só o próprio admin enxerga a própria linha.
--   3. is_admin(): função usada pelas regras abaixo.
--   4. doctor_audit_logs: leitura direta SÓ para o administrador (quem editou aparece só para ele).
--   5. doctor_history(): o histórico de edições que os representantes veem, com o nome de quem está
--      em modo privado trocado por "Representante" (o admin vê o nome real).
-- Pode rodar mais de uma vez.
-- ============================================================

ALTER TABLE rep_profiles ADD COLUMN IF NOT EXISTS private_mode BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_admins_self ON app_admins;
CREATE POLICY app_admins_self ON app_admins FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON app_admins FROM authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON app_admins FROM anon'; END IF;
END $$;

-- Administrador do app
INSERT INTO app_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'nestorhmesquita@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()) $$;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Log de auditoria: leitura direta só do administrador
DROP POLICY IF EXISTS doctor_audit_logs_read ON doctor_audit_logs;
CREATE POLICY doctor_audit_logs_read ON doctor_audit_logs FOR SELECT TO authenticated USING (is_admin());

-- Histórico que os representantes enxergam (sem expor quem está em modo privado)
CREATE OR REPLACE FUNCTION doctor_history(p_doctor UUID)
RETURNS TABLE (id BIGINT, action TEXT, actor_name TEXT, created_at TIMESTAMPTZ, changes JSONB, actor_private BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id,
         l.action,
         CASE WHEN is_admin() OR l.actor_id = auth.uid() OR NOT COALESCE(p.private_mode, false)
              THEN l.actor_name ELSE 'Representante' END,
         l.created_at,
         l.changes,
         COALESCE(p.private_mode, false)
  FROM doctor_audit_logs l
  LEFT JOIN rep_profiles p ON p.user_id = l.actor_id
  WHERE l.doctor_id = p_doctor
  ORDER BY l.created_at DESC
  LIMIT 100
$$;
GRANT EXECUTE ON FUNCTION doctor_history(UUID) TO authenticated;
