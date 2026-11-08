BEGIN;
ALTER TABLE journals ADD COLUMN IF NOT EXISTS independent_count integer NOT NULL DEFAULT 0;
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_check CHECK(kind IN ('lesson','test','independent'));
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_slot_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_slot_check CHECK((kind='lesson' AND slot IS NOT NULL AND slot BETWEEN 1 AND 12) OR (kind IN ('test','independent') AND slot IS NULL));
CREATE OR REPLACE FUNCTION enforce_test_mark() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_kind text;
BEGIN
 SELECT kind INTO entry_kind FROM lessons WHERE id=NEW.lesson_id;
 IF entry_kind='test' THEN
  IF cardinality(NEW.grades)>1 THEN RAISE EXCEPTION 'Для этой работы разрешена только одна оценка' USING ERRCODE='23514'; END IF;
  IF NEW.attendance NOT IN ('unknown','absent') THEN RAISE EXCEPTION 'Для этой работы разрешена только отметка Н' USING ERRCODE='23514'; END IF;
 ELSIF entry_kind='independent' THEN
  IF cardinality(NEW.grades)>2 THEN RAISE EXCEPTION 'В самостоятельной разрешены две оценки' USING ERRCODE='23514'; END IF;
  IF NEW.attendance NOT IN ('unknown','present','absent') THEN RAISE EXCEPTION 'Для самостоятельной доступны только отметки Был и Не был' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_test_mark_trigger ON marks;
CREATE TRIGGER enforce_test_mark_trigger BEFORE INSERT OR UPDATE ON marks FOR EACH ROW EXECUTE FUNCTION enforce_test_mark();
COMMIT;
