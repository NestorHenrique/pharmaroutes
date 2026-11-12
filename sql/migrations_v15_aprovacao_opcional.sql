-- ============================================================
-- PharmaRoutes v15 — Aprovação de edições é OPCIONAL (começa desligada)
-- Pode rodar mais de uma vez. Aditivo.
-- Interruptor em Perfil > "Aprovação de edições": ligado, mudar nome/CRM/UF/especialidade pede o ok de um colega
-- (ou vale sozinho em 24 h). Desligado, edita direto, como antes.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  name       TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID DEFAULT auth.uid()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_read  ON app_settings;
DROP POLICY IF EXISTS app_settings_write ON app_settings;
CREATE POLICY app_settings_read  ON app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY app_settings_write ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON app_settings FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON app_settings TO authenticated;
INSERT INTO app_settings (name, value) VALUES ('edit_approval', 'off') ON CONFLICT (name) DO NOTHING;
NOTIFY pgrst, 'reload schema';
