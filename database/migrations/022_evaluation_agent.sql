ALTER TABLE research.agent_sessions DROP CONSTRAINT agent_sessions_agent_check;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_agent_check
 CHECK(agent IN ('automation','requirements','tests','evaluation'));
