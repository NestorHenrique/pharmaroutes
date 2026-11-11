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
