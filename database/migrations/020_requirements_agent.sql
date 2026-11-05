ALTER TABLE research.requirement_parts ADD CONSTRAINT requirement_parts_run_identity UNIQUE(run_id,id);
ALTER TABLE research.agent_sessions DROP CONSTRAINT agent_sessions_agent_check;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_agent_check CHECK(agent IN ('automation','requirements'));
ALTER TABLE research.agent_sessions ADD COLUMN requirement_part_id UUID;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_requirement_part_fk
 FOREIGN KEY(run_id,requirement_part_id) REFERENCES research.requirement_parts(run_id,id);
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_part_role_check
 CHECK((automation_part_id IS NULL OR agent='automation') AND (requirement_part_id IS NULL OR agent='requirements'));
CREATE UNIQUE INDEX agent_sessions_one_active_requirement_part ON research.agent_sessions(requirement_part_id)
 WHERE requirement_part_id IS NOT NULL AND status IN ('pending','running');
CREATE UNIQUE INDEX agent_sessions_one_active_whole_stage ON research.agent_sessions(stage_id)
 WHERE automation_part_id IS NULL AND requirement_part_id IS NULL AND status IN ('pending','running');
