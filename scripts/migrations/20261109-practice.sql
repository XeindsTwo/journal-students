BEGIN;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS practice_no integer;
ALTER TABLE marks ADD COLUMN IF NOT EXISTS overdue boolean NOT NULL DEFAULT false;
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_practice_no_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_practice_no_check CHECK((kind='practice' AND practice_no IS NOT NULL AND practice_no BETWEEN 1 AND 9999) OR (kind<>'practice' AND practice_no IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS lessons_practice_no_unique ON lessons(journal_id,practice_no) WHERE kind='practice';
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_check CHECK(kind IN ('lesson','test','independent','practice'));
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_kind_slot_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_kind_slot_check CHECK((kind='lesson' AND slot IS NOT NULL AND slot BETWEEN 1 AND 12) OR (kind IN ('test','independent','practice') AND slot IS NULL));
CREATE OR REPLACE FUNCTION enforce_test_mark() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_kind text;
BEGIN
 SELECT kind INTO entry_kind FROM lessons WHERE id=NEW.lesson_id;
 IF NEW.overdue AND entry_kind<>'practice' THEN RAISE EXCEPTION 'Отметка срока доступна только для практической' USING ERRCODE='23514'; END IF;
 IF entry_kind IN ('test','practice') THEN
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
