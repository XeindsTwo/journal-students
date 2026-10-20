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
