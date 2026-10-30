ALTER TABLE research.runs ADD COLUMN consolidation JSONB;
CREATE TABLE research.requirement_parts (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 input JSONB NOT NULL,
 output JSONB,
 segments JSONB NOT NULL,
 character_count INTEGER NOT NULL CHECK(character_count>=0),
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),
 error TEXT,
 UNIQUE(run_id,sequence)
);
ALTER TABLE research.attempts DROP CONSTRAINT attempts_number_check;
ALTER TABLE research.attempts ADD CONSTRAINT attempts_number_check CHECK(number>0);
ALTER TABLE research.attempts ADD COLUMN requirement_part_id UUID REFERENCES research.requirement_parts(id);
CREATE INDEX requirement_parts_run_idx ON research.requirement_parts(run_id,sequence);
