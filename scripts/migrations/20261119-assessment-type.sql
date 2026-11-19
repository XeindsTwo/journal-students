BEGIN;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS assessment_type text NOT NULL DEFAULT 'grade';
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_assessment_type_check;
ALTER TABLE lessons ADD CONSTRAINT lessons_assessment_type_check CHECK(assessment_type IN ('grade','credit') AND (kind='practice' OR assessment_type='grade'));
COMMIT;
