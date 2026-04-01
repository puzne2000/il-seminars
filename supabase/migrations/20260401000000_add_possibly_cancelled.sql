ALTER TABLE seminars ADD COLUMN IF NOT EXISTS possibly_cancelled boolean NOT NULL DEFAULT false;
