ALTER TABLE research.attempts ADD CONSTRAINT attempts_stage_identity UNIQUE(stage_id,id);
ALTER TABLE research.automation_parts ADD CONSTRAINT automation_parts_run_identity UNIQUE(run_id,id);

CREATE TABLE research.agent_sessions (
 id UUID PRIMARY KEY,
 project_id UUID NOT NULL,
 run_id UUID NOT NULL,
 stage_id UUID NOT NULL,
 attempt_id UUID NOT NULL UNIQUE,
 automation_part_id UUID,
 agent TEXT NOT NULL CHECK(agent='automation'),
 mode TEXT NOT NULL CHECK(mode='agent/v1'),
 status TEXT NOT NULL CHECK(status IN ('pending','running','interrupted','completed','failed','cancelled','exhausted')),
 task JSONB NOT NULL,
 policy JSONB NOT NULL,
 context JSONB NOT NULL,
 output JSONB,
 stop_reason TEXT,
 model_turns INTEGER NOT NULL DEFAULT 0 CHECK(model_turns>=0),
 tool_calls INTEGER NOT NULL DEFAULT 0 CHECK(tool_calls>=0),
 total_tokens BIGINT NOT NULL DEFAULT 0 CHECK(total_tokens>=0),
 usage_unknown BOOLEAN NOT NULL DEFAULT false,
 elapsed_ms INTEGER NOT NULL DEFAULT 0 CHECK(elapsed_ms>=0),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,
 FOREIGN KEY(project_id,run_id) REFERENCES research.runs(project_id,id),
 FOREIGN KEY(run_id,stage_id) REFERENCES research.stages(run_id,id),
 FOREIGN KEY(stage_id,attempt_id) REFERENCES research.attempts(stage_id,id),
 FOREIGN KEY(run_id,automation_part_id) REFERENCES research.automation_parts(run_id,id),
 UNIQUE(run_id,id)
);
CREATE UNIQUE INDEX agent_sessions_one_active_part ON research.agent_sessions(automation_part_id)
 WHERE automation_part_id IS NOT NULL AND status IN ('pending','running');
CREATE INDEX agent_sessions_run_idx ON research.agent_sessions(run_id,started_at);

CREATE TABLE research.agent_steps (
 id UUID PRIMARY KEY,
 session_id UUID NOT NULL REFERENCES research.agent_sessions(id),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 status TEXT NOT NULL CHECK(status IN ('requested','completed','interrupted')),
 request JSONB NOT NULL,
 response JSONB,
 provider_metadata JSONB,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,
 UNIQUE(session_id,sequence),
 UNIQUE(session_id,id)
);
CREATE TABLE research.agent_tool_calls (
 id UUID PRIMARY KEY,
 session_id UUID NOT NULL,
 step_id UUID NOT NULL,
 call_id TEXT NOT NULL CHECK(length(call_id) BETWEEN 1 AND 200),
 name TEXT NOT NULL,
 tool_version TEXT NOT NULL,
 arguments JSONB NOT NULL,
 observation JSONB,
 status TEXT NOT NULL CHECK(status IN ('requested','completed','rejected')),
 duration_ms INTEGER CHECK(duration_ms>=0),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ,
 FOREIGN KEY(session_id,step_id) REFERENCES research.agent_steps(session_id,id),
 UNIQUE(step_id,call_id)
);
