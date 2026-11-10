-- ============================================================
-- PharmaRoutes v8 — Ajuste de dados (já aplicado em produção em 2026-11-10)
-- Pode rodar mais de uma vez sem quebrar nada.
--
--   1. CRM só com números ("pi8786" -> "8786"); a UF fica no campo uf (tela mostra "CRM 8786/PI")
--   2. Telefone antigo ("fixo") migra para WhatsApp médico; o campo fixo fica vazio.
--      Médico que já tinha WhatsApp médico diferente do telefone mantém os dois.
--      O valor antigo continua no histórico (doctor_audit_logs).
-- Rode os dois comandos separados (um UPDATE por vez).
-- ============================================================

UPDATE doctors SET crm = regexp_replace(crm, '\D', '', 'g')
WHERE crm ~ '[^0-9]' AND regexp_replace(crm, '\D', '', 'g') <> '';

UPDATE doctors
SET whatsapp_medico = CASE WHEN COALESCE(btrim(whatsapp_medico), '') = '' THEN btrim(telefone) ELSE whatsapp_medico END,
    telefone = CASE WHEN COALESCE(btrim(whatsapp_medico), '') = '' OR btrim(whatsapp_medico) = btrim(telefone) THEN NULL ELSE telefone END
WHERE COALESCE(btrim(telefone), '') <> '';
