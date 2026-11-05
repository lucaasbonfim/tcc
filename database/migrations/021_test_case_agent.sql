ALTER TABLE research.test_parts ADD CONSTRAINT test_parts_run_identity UNIQUE(run_id,id);
ALTER TABLE research.agent_sessions DROP CONSTRAINT agent_sessions_agent_check;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_agent_check CHECK(agent IN ('automation','requirements','tests'));
ALTER TABLE research.agent_sessions ADD COLUMN test_part_id UUID;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_test_part_fk FOREIGN KEY(run_id,test_part_id) REFERENCES research.test_parts(run_id,id);
ALTER TABLE research.agent_sessions DROP CONSTRAINT agent_sessions_part_role_check;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_part_role_check CHECK(
 (automation_part_id IS NULL OR agent='automation') AND (requirement_part_id IS NULL OR agent='requirements') AND (test_part_id IS NULL OR agent='tests'));
DROP INDEX research.agent_sessions_one_active_whole_stage;
CREATE UNIQUE INDEX agent_sessions_one_active_whole_stage ON research.agent_sessions(stage_id)
 WHERE automation_part_id IS NULL AND requirement_part_id IS NULL AND test_part_id IS NULL AND status IN ('pending','running');
CREATE UNIQUE INDEX agent_sessions_one_active_test_part ON research.agent_sessions(test_part_id)
 WHERE test_part_id IS NOT NULL AND status IN ('pending','running');
