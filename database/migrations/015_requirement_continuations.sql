ALTER TABLE research.runs ADD COLUMN resumed_from_run_id UUID REFERENCES research.runs(id);
ALTER TABLE research.requirement_parts ADD COLUMN reused_from_part_id UUID REFERENCES research.requirement_parts(id);
CREATE INDEX runs_resumed_from_idx ON research.runs(resumed_from_run_id);
