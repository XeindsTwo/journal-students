CREATE TABLE IF NOT EXISTS groups (
 id serial PRIMARY KEY, name text NOT NULL CHECK(length(name)>0)
);
CREATE TABLE IF NOT EXISTS students (
 id serial PRIMARY KEY, group_id integer NOT NULL REFERENCES groups(id), name text NOT NULL,
 joined_on date NOT NULL DEFAULT CURRENT_DATE, left_on date,
 CHECK(left_on IS NULL OR left_on >= joined_on)
);
CREATE TABLE IF NOT EXISTS journals (
 id serial PRIMARY KEY, group_id integer NOT NULL REFERENCES groups(id),
 name text NOT NULL, short_name text NOT NULL, period text NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
 id serial PRIMARY KEY, journal_id integer NOT NULL REFERENCES journals(id),
 date date NOT NULL, slot integer NOT NULL CHECK(slot BETWEEN 1 AND 12),
 title text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
 tags text[] NOT NULL DEFAULT '{}', attendance_checked boolean NOT NULL DEFAULT false,
 UNIQUE(journal_id,date,slot)
);
CREATE TABLE IF NOT EXISTS marks (
 lesson_id integer NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 student_id integer NOT NULL REFERENCES students(id),
 attendance text NOT NULL DEFAULT 'unknown' CHECK(attendance IN ('unknown','present','absent')),
 grade integer CHECK(grade BETWEEN 2 AND 5), PRIMARY KEY(lesson_id,student_id)
);

-- Extend attendance without removing existing marks.
BEGIN;
ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_attendance_check;
ALTER TABLE marks ADD CONSTRAINT marks_attendance_check CHECK(attendance IN ('unknown','present','absent','late'));
COMMIT;

-- Backfill once; never recreate a grade after the user has cleared it.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marks' AND column_name='grades') THEN
  ALTER TABLE marks ADD COLUMN grades integer[] NOT NULL DEFAULT '{}';
  UPDATE marks SET grades=ARRAY[grade] WHERE grade IS NOT NULL;
 END IF;
END $$;
ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_grades_check;
ALTER TABLE marks ADD CONSTRAINT marks_grades_check CHECK(grades <@ ARRAY[2,3,4,5] AND cardinality(grades)<=100 AND array_position(grades,NULL) IS NULL);
COMMIT;

CREATE TABLE IF NOT EXISTS mutation_receipts (request_id uuid PRIMARY KEY,digest text NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());

-- Owner-only authentication. Session tokens are stored as hashes.
CREATE TABLE IF NOT EXISTS auth_sessions(token_hash text PRIMARY KEY,owner_fingerprint text NOT NULL,expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_attempts(key text PRIMARY KEY,attempts integer NOT NULL,window_start timestamptz NOT NULL);

-- A single owner account. Passwords are stored only as salted hashes.
CREATE TABLE IF NOT EXISTS auth_users (id smallint PRIMARY KEY DEFAULT 1 CHECK(id=1),username text NOT NULL UNIQUE CHECK(length(username) BETWEEN 3 AND 100),password_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());

-- Independent test columns
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
