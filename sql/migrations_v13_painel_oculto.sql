-- ============================================================
-- PharmaRoutes v13 — "Excluir do meu painel"
-- Rode no Supabase SQL Editor. Pode rodar mais de uma vez sem quebrar nada.
-- Aditivo: só cria uma tabela. O app funciona antes e depois dela
-- (sem ela, guarda a lista de ocultos no aparelho e sobe para cá quando a tabela existir).
--
-- Antes: o botão Excluir apagava o médico da base para TODOS os representantes.
-- Agora: cada representante oculta o médico só do PRÓPRIO painel; ele continua na base e nos
-- painéis dos colegas. Para voltar, basta cadastrar o mesmo CRM em "Novo médico" > "Adicionar ao meu painel".
-- ============================================================

CREATE TABLE IF NOT EXISTS rep_hidden_doctors (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doctor_id)
);

ALTER TABLE rep_hidden_doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rep_hidden_doctors_own ON rep_hidden_doctors;
CREATE POLICY rep_hidden_doctors_own ON rep_hidden_doctors
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON rep_hidden_doctors TO authenticated;

NOTIFY pgrst, 'reload schema';
