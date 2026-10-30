CREATE TABLE research.execution_jobs (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL UNIQUE REFERENCES research.runs(id),
 stage_id UUID NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 adapter TEXT NOT NULL,
 bundle JSONB NOT NULL,
 request_sha256 CHAR(64) NOT NULL,
 executor_receipt JSONB NOT NULL,
 result JSONB,
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,
 UNIQUE(run_id,id),
 FOREIGN KEY(run_id,stage_id) REFERENCES research.stages(run_id,id)
);
CREATE TABLE research.evidence (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL,
 job_id UUID NOT NULL UNIQUE,
 artifact JSONB NOT NULL,
 origin TEXT NOT NULL DEFAULT 'executor' CHECK(origin='executor'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(run_id,id),
 UNIQUE(job_id,id),
 FOREIGN KEY(run_id,job_id) REFERENCES research.execution_jobs(run_id,id)
);
CREATE TABLE research.test_results (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL,
 job_id UUID NOT NULL,
 evidence_id UUID NOT NULL,
 automated_test_id UUID NOT NULL,
 test_case_id UUID NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('passed','failed','test_error','compilation_error','infrastructure_error','dependency_unavailable','timeout','cancelled','unsupported','inconclusive','skipped')),
 content JSONB NOT NULL,
 UNIQUE(run_id,id),
 FOREIGN KEY(job_id,evidence_id) REFERENCES research.evidence(job_id,id),
 FOREIGN KEY(run_id,automated_test_id) REFERENCES research.automated_tests(run_id,id),
 FOREIGN KEY(run_id,test_case_id) REFERENCES research.test_cases(run_id,id)
);
CREATE INDEX test_results_run_idx ON research.test_results(run_id);
