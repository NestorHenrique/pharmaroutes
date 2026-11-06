-- ============================================================
-- PharmaRoutes v3 — Migrations
-- Rode no Supabase SQL Editor DEPOIS do migrations.sql (v2).
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================

-- 1. Novos campos em doctors
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS especialidade TEXT,
  ADD COLUMN IF NOT EXISTS uf            TEXT DEFAULT 'PI',
  ADD COLUMN IF NOT EXISTS created_via   TEXT DEFAULT 'BASE_IMPORT',
  ADD COLUMN IF NOT EXISTS agenda        JSONB;

-- UF: base atual é do Piauí; ajuste o UPDATE se houver médicos de outro estado
UPDATE doctors SET uf = 'PI' WHERE uf IS NULL OR btrim(uf) = '';
ALTER TABLE doctors ALTER COLUMN uf SET NOT NULL;

-- Origem: tudo que já existe conta como importação de base.
-- Daqui pra frente o app grava 'APP_FIELD'; importações CSV ficam com o default.
UPDATE doctors SET created_via = 'BASE_IMPORT' WHERE created_via IS NULL;
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_created_via_check;
ALTER TABLE doctors ADD CONSTRAINT doctors_created_via_check
  CHECK (created_via IN ('APP_FIELD', 'BASE_IMPORT'));

-- 2. Agenda granular: [{ "day": "seg", "shift": "INTEGRAL" }, ...]
--    Preenche a partir de dias_semana/dia_semana + turno (só onde agenda está vazia)
DO $$
DECLARE
  src TEXT;
BEGIN
  SELECT CASE
           WHEN bool_or(column_name = 'dias_semana') AND bool_or(column_name = 'dia_semana')
             THEN 'coalesce(nullif(dias_semana, ''''), dia_semana, '''')'
           WHEN bool_or(column_name = 'dias_semana') THEN 'coalesce(dias_semana, '''')'
           WHEN bool_or(column_name = 'dia_semana')  THEN 'coalesce(dia_semana, '''')'
         END
    INTO src
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'doctors'
     AND column_name IN ('dias_semana', 'dia_semana');

  IF src IS NULL THEN
    RAISE NOTICE 'Nenhuma coluna de dias encontrada; agenda não preenchida.';
    RETURN;
  END IF;

  EXECUTE format($q$
    UPDATE doctors d
       SET agenda = sub.agenda
      FROM (
        SELECT id,
               jsonb_agg(
                 jsonb_build_object(
                   'day', day,
                   'shift', CASE
                     WHEN turno IS NULL OR btrim(turno) = '' THEN 'INTEGRAL'
                     WHEN turno ILIKE '%%manh%%' AND turno ILIKE '%%tarde%%' THEN 'INTEGRAL'
                     WHEN turno ILIKE '%%integral%%' THEN 'INTEGRAL'
                     WHEN turno ILIKE 'manh%%' THEN 'MANHA'
                     WHEN turno ILIKE 'tarde%%' THEN 'TARDE'
                     WHEN turno ILIKE 'noite%%' THEN 'NOITE'
                     ELSE 'INTEGRAL'
                   END
                 )
                 ORDER BY array_position(ARRAY['seg','ter','qua','qui','sex','sab','dom'], day)
               ) AS agenda
          FROM (
            SELECT DISTINCT id, turno, lower(btrim(x)) AS day
              FROM doctors, regexp_split_to_table(%s, '[,;]') AS x
          ) days
         WHERE day IN ('seg','ter','qua','qui','sex','sab','dom')
         GROUP BY id
      ) sub
     WHERE d.id = sub.id
       AND (d.agenda IS NULL OR d.agenda = '[]'::jsonb)
  $q$, src);
END $$;

-- 3. Perfil do representante (nome, especialidades da carteira, filtro)
CREATE TABLE IF NOT EXISTS rep_profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  specialties  TEXT[]  NOT NULL DEFAULT '{}',
  show_all     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rep_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rep_profiles_own ON rep_profiles;
CREATE POLICY rep_profiles_own ON rep_profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Carteira: médicos vinculados manualmente ao representante
CREATE TABLE IF NOT EXISTS rep_portfolio (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id  UUID NOT NULL REFERENCES doctors(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, doctor_id)
);
ALTER TABLE rep_portfolio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rep_portfolio_own ON rep_portfolio;
CREATE POLICY rep_portfolio_own ON rep_portfolio
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Inscrições de Web Push por cidade
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  city       TEXT NOT NULL,
  city_key   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_city_key_idx ON push_subscriptions (city_key);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own ON push_subscriptions;
CREATE POLICY push_subscriptions_own ON push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. CRM + UF único (só cria o índice se a base não tiver duplicados)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM doctors
     WHERE nullif(regexp_replace(coalesce(crm, ''), '\D', '', 'g'), '') IS NOT NULL
     GROUP BY regexp_replace(crm, '\D', '', 'g'), upper(uf)
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Há CRMs duplicados; índice único NÃO criado. Veja a lista no resultado.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS doctors_crm_uf_unique
      ON doctors ((regexp_replace(crm, '\D', '', 'g')), (upper(uf)))
      WHERE nullif(regexp_replace(coalesce(crm, ''), '\D', '', 'g'), '') IS NOT NULL;
  END IF;
END $$;

-- 7. Atualiza o cache da API
NOTIFY pgrst, 'reload schema';

-- 8. Resultado: CRMs duplicados.
--    Se aparecer alguma linha, o índice único não foi criado: corrija esses médicos
--    (exclua ou ajuste o CRM/UF) e rode este arquivo de novo.
SELECT regexp_replace(crm, '\D', '', 'g') AS crm_numero,
       upper(uf)                          AS uf,
       count(*)                           AS quantidade,
       string_agg(descricao, ' | ')       AS medicos
  FROM doctors
 WHERE nullif(regexp_replace(coalesce(crm, ''), '\D', '', 'g'), '') IS NOT NULL
 GROUP BY 1, 2
HAVING count(*) > 1
 ORDER BY 3 DESC;
