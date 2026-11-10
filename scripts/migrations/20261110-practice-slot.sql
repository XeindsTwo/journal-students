BEGIN;
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_slot_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_slot_check CHECK((kind='lesson' AND slot IS NOT NULL AND slot BETWEEN 1 AND 12) OR (kind='practice' AND (slot IS NULL OR slot BETWEEN 1 AND 12)) OR (kind IN ('test','independent') AND slot IS NULL));
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_journal_id_date_slot_key;
CREATE UNIQUE INDEX IF NOT EXISTS lessons_regular_slot_unique ON lessons(journal_id,date,slot) WHERE kind='lesson';
COMMIT;
