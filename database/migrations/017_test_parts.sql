CREATE TABLE research.test_parts (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 input JSONB NOT NULL,
 output JSONB,
 requirement_codes JSONB NOT NULL,
 mapping JSONB NOT NULL DEFAULT '[]',
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),
 error TEXT,
 UNIQUE(run_id,sequence)
);
ALTER TABLE research.attempts ADD COLUMN test_part_id UUID REFERENCES research.test_parts(id);
CREATE INDEX test_parts_run_idx ON research.test_parts(run_id,sequence);
