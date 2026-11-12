-- v18: tipo de local (consultorio, ubs, psm, samu, hospital) em cada local EXTRA do médico.
-- O Local 1 continua usando doctors.categoria. Sem esta migração o app funciona igual:
-- o tipo do local extra simplesmente não é gravado (e aparece como Consultório).
ALTER TABLE doctor_places ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'consultorio';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_places_categoria_check') THEN
    ALTER TABLE doctor_places ADD CONSTRAINT doctor_places_categoria_check
      CHECK (categoria IN ('consultorio', 'ubs', 'psm', 'samu', 'hospital'));
  END IF;
END $$;
