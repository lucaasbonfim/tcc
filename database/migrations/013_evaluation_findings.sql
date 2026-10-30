CREATE TABLE research.findings (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 evaluation_attempt_id UUID NOT NULL REFERENCES research.attempts(id),
 test_result_id UUID NOT NULL,
 automated_test_id UUID NOT NULL,
 test_case_id UUID NOT NULL,
 requirement_id UUID NOT NULL,
 content JSONB NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','confirmed','rejected','inconclusive')),
 human_classification TEXT CHECK(human_classification IN ('compatible','possible_functional_divergence','test_problem','environment_failure','inconclusive')),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(test_result_id,requirement_id),
 FOREIGN KEY(run_id,test_result_id) REFERENCES research.test_results(run_id,id),
 FOREIGN KEY(run_id,automated_test_id) REFERENCES research.automated_tests(run_id,id),
 FOREIGN KEY(run_id,test_case_id) REFERENCES research.test_cases(run_id,id),
 FOREIGN KEY(run_id,requirement_id) REFERENCES research.requirements(run_id,id)
);
CREATE INDEX findings_run_idx ON research.findings(run_id);
