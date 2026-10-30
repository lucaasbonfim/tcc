CREATE TABLE research.automation_parts (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 input JSONB NOT NULL,
 output JSONB,
 case_ids JSONB NOT NULL,
 dispositions JSONB NOT NULL DEFAULT '[]',
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),
 error TEXT,
 UNIQUE(run_id,sequence)
);
ALTER TABLE research.attempts ADD COLUMN automation_part_id UUID REFERENCES research.automation_parts(id);
CREATE INDEX automation_parts_run_idx ON research.automation_parts(run_id,sequence);
