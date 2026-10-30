ALTER TABLE research.stages DROP CONSTRAINT stages_agent_check;
ALTER TABLE research.stages ADD CONSTRAINT stages_agent_check CHECK(agent IN ('requirements','tests','automation','execution','evaluation'));
ALTER TABLE research.stages DROP CONSTRAINT stages_position_check;
ALTER TABLE research.stages ADD CONSTRAINT stages_position_check CHECK(position BETWEEN 1 AND 5);
ALTER TABLE research.stages ADD COLUMN context JSONB;
ALTER TABLE research.reviews DROP CONSTRAINT reviews_entity_type_check;
ALTER TABLE research.reviews ADD CONSTRAINT reviews_entity_type_check CHECK(entity_type IN ('requirement','test_case','stage','run','automated_test','finding'));
ALTER TABLE research.reviews DROP CONSTRAINT reviews_decision_check;
ALTER TABLE research.reviews ADD CONSTRAINT reviews_decision_check CHECK(decision IN ('approved','rejected','cancelled','retry','confirmed','inconclusive'));

CREATE TABLE research.automated_tests (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 test_case_id UUID NOT NULL,
 generation_attempt_id UUID NOT NULL REFERENCES research.attempts(id),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 adapter TEXT NOT NULL CHECK(adapter IN ('node-test/v2','java-junit/v1')),
 content JSONB NOT NULL,
 files JSONB NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 compatibility TEXT NOT NULL CHECK(compatibility IN ('compatible','unsupported','needs_review')),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(run_id,test_case_id,version),
 UNIQUE(run_id,id),
 FOREIGN KEY(run_id,test_case_id) REFERENCES research.test_cases(run_id,id)
);
