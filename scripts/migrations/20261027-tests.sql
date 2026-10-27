BEGIN;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lesson';
ALTER TABLE lessons ALTER COLUMN slot DROP NOT NULL;
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_check CHECK(kind IN ('lesson','test'));
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_slot_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_slot_check CHECK((kind='lesson' AND slot IS NOT NULL AND slot BETWEEN 1 AND 12) OR (kind='test' AND slot IS NULL));
CREATE OR REPLACE FUNCTION enforce_test_mark() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM lessons WHERE id=NEW.lesson_id AND kind='test') THEN
  IF cardinality(NEW.grades)>1 THEN RAISE EXCEPTION 'В тесте разрешена только одна оценка' USING ERRCODE='23514'; END IF;
  IF NEW.attendance NOT IN ('unknown','absent') THEN RAISE EXCEPTION 'В тесте разрешена только отметка Н' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_test_mark_trigger ON marks;
CREATE TRIGGER enforce_test_mark_trigger BEFORE INSERT OR UPDATE ON marks FOR EACH ROW EXECUTE FUNCTION enforce_test_mark();
COMMIT;
