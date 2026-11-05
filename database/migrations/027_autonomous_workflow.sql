ALTER TABLE research.runs ADD COLUMN workflow_mode TEXT NOT NULL DEFAULT 'assisted/v1' CHECK(workflow_mode IN ('assisted/v1','autonomous/v1'));
ALTER TABLE research.runs ADD COLUMN workflow_error TEXT;
ALTER TABLE research.requirements ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'produced' CHECK(processing_status IN ('produced','eligible'));
ALTER TABLE research.test_cases ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'produced' CHECK(processing_status IN ('produced','eligible'));
ALTER TABLE research.automated_tests ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'produced' CHECK(processing_status IN ('produced','eligible'));
CREATE FUNCTION research.artifact_eligible(target_run UUID,human_status TEXT,technical_status TEXT) RETURNS BOOLEAN
 LANGUAGE SQL STABLE AS $$ SELECT human_status='approved' OR (human_status='pending' AND technical_status='eligible' AND EXISTS(SELECT 1 FROM research.runs WHERE id=target_run AND workflow_mode='autonomous/v1')) $$;
CREATE TABLE research.run_grants (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL UNIQUE REFERENCES research.runs(id),
 policy JSONB NOT NULL,
 actor TEXT NOT NULL CHECK(actor='admin'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(run_id,id)
);
CREATE TABLE research.artifact_snapshots (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 source_key TEXT NOT NULL,
 stage_id UUID,
 attempt_id UUID,
 kind TEXT NOT NULL CHECK(kind IN ('input','output','artifact','execution')),
 label TEXT NOT NULL,
 artifact JSONB NOT NULL,
 entity_type TEXT,
 entity_id UUID,
 revision INTEGER,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(run_id,id),UNIQUE(run_id,source_key),
 FOREIGN KEY(run_id,stage_id) REFERENCES research.stages(run_id,id),
 FOREIGN KEY(stage_id,attempt_id) REFERENCES research.attempts(stage_id,id)
);
CREATE TABLE research.run_events (
 id UUID PRIMARY KEY,
 sequence BIGSERIAL NOT NULL UNIQUE,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 source_key TEXT NOT NULL,
 kind TEXT NOT NULL,
 actor TEXT NOT NULL CHECK(actor IN ('human','system','agent','executor')),
 agent TEXT,
 recipient TEXT,
 stage_id UUID,
 attempt_id UUID,
 session_id UUID,
 message_id UUID,
 job_id UUID,
 snapshot_id UUID,
 correlation_id UUID,
 payload JSONB NOT NULL DEFAULT '{}',
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(run_id,source_key),
 FOREIGN KEY(run_id,stage_id) REFERENCES research.stages(run_id,id),
 FOREIGN KEY(stage_id,attempt_id) REFERENCES research.attempts(stage_id,id),
 FOREIGN KEY(run_id,session_id) REFERENCES research.agent_sessions(run_id,id),
 FOREIGN KEY(run_id,message_id) REFERENCES research.agent_messages(run_id,id),
 FOREIGN KEY(run_id,job_id) REFERENCES research.execution_jobs(run_id,id),
 FOREIGN KEY(run_id,snapshot_id) REFERENCES research.artifact_snapshots(run_id,id)
);
CREATE INDEX run_events_cursor ON research.run_events(run_id,sequence);
ALTER TABLE research.execution_plans ADD COLUMN authorization_source TEXT NOT NULL DEFAULT 'human' CHECK(authorization_source IN ('human','initial_grant'));
ALTER TABLE research.execution_plans ADD COLUMN grant_id UUID;
ALTER TABLE research.execution_plans ADD CONSTRAINT execution_plans_grant_fk FOREIGN KEY(run_id,grant_id) REFERENCES research.run_grants(run_id,id);
