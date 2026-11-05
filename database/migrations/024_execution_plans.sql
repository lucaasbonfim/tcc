CREATE TABLE research.execution_plans (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL UNIQUE REFERENCES research.runs(id),
 format_version INTEGER NOT NULL CHECK(format_version IN (0,1)),
 planner_mode TEXT NOT NULL DEFAULT 'deterministic/v1' CHECK(planner_mode IN ('deterministic/v1','agent/v1')),
 status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled')),
 manifest JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,
 UNIQUE(run_id,id)
);
INSERT INTO research.execution_plans(id,run_id,format_version,status,manifest,created_at,finished_at)
 SELECT id,run_id,0,status,bundle,created_at,finished_at FROM research.execution_jobs;
ALTER TABLE research.execution_jobs ADD COLUMN plan_id UUID;
ALTER TABLE research.execution_jobs ADD COLUMN sequence INTEGER NOT NULL DEFAULT 1 CHECK(sequence>0);
ALTER TABLE research.execution_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0);
UPDATE research.execution_jobs SET plan_id=id;
ALTER TABLE research.execution_jobs ALTER COLUMN plan_id SET NOT NULL;
ALTER TABLE research.execution_jobs ADD CONSTRAINT execution_jobs_plan_fk FOREIGN KEY(run_id,plan_id) REFERENCES research.execution_plans(run_id,id);
ALTER TABLE research.execution_jobs DROP CONSTRAINT execution_jobs_run_id_key;
ALTER TABLE research.execution_jobs ADD CONSTRAINT execution_jobs_plan_sequence UNIQUE(plan_id,sequence);
ALTER TABLE research.execution_jobs ADD CONSTRAINT execution_jobs_stage_identity UNIQUE(stage_id,id);
ALTER TABLE research.attempts ADD COLUMN execution_job_id UUID;
UPDATE research.attempts a SET execution_job_id=j.id FROM research.execution_jobs j WHERE a.stage_id=j.stage_id;
ALTER TABLE research.attempts ADD CONSTRAINT attempts_execution_job_fk FOREIGN KEY(stage_id,execution_job_id) REFERENCES research.execution_jobs(stage_id,id);
