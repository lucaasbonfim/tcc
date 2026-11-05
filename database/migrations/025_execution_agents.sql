ALTER TABLE research.agent_sessions DROP CONSTRAINT agent_sessions_agent_check;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_agent_check CHECK(agent IN ('automation','requirements','tests','evaluation','execution'));
ALTER TABLE research.agent_sessions ADD COLUMN execution_phase TEXT;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_execution_phase_check CHECK(
 (agent='execution' AND execution_phase IS NOT NULL AND execution_phase IN ('planning','diagnosis')) OR (agent<>'execution' AND execution_phase IS NULL));
CREATE TABLE research.execution_proposals (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 stage_id UUID NOT NULL,
 attempt_id UUID NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('planning','diagnosis')),
 input JSONB NOT NULL,
 output JSONB NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','accepted','rejected','revision_requested')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ,
 UNIQUE(run_id,id),
 UNIQUE(run_id,phase),
 FOREIGN KEY(run_id,stage_id) REFERENCES research.stages(run_id,id),
 FOREIGN KEY(stage_id,attempt_id) REFERENCES research.attempts(stage_id,id)
);
ALTER TABLE research.execution_plans ADD COLUMN proposal_id UUID;
ALTER TABLE research.execution_plans ADD CONSTRAINT execution_plans_proposal_fk FOREIGN KEY(run_id,proposal_id) REFERENCES research.execution_proposals(run_id,id);
