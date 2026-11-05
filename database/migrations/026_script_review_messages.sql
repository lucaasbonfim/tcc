ALTER TABLE research.agent_messages DROP CONSTRAINT agent_messages_sender_check;
ALTER TABLE research.agent_messages DROP CONSTRAINT agent_messages_recipient_check;
ALTER TABLE research.agent_messages DROP CONSTRAINT agent_messages_kind_check;
ALTER TABLE research.agent_messages ALTER COLUMN requirement_id DROP NOT NULL;
ALTER TABLE research.agent_messages ALTER COLUMN requirement_revision DROP NOT NULL;
ALTER TABLE research.agent_messages ADD COLUMN automated_test_id UUID;
ALTER TABLE research.agent_messages ADD COLUMN test_result_id UUID;
ALTER TABLE research.agent_messages ADD COLUMN script_version INTEGER CHECK(script_version>0);
ALTER TABLE research.agent_messages ADD COLUMN script_revision INTEGER CHECK(script_revision>=0);
ALTER TABLE research.test_results ADD CONSTRAINT test_results_script_identity UNIQUE(run_id,id,automated_test_id);
ALTER TABLE research.agent_messages ADD CONSTRAINT agent_messages_result_script_fk FOREIGN KEY(run_id,test_result_id,automated_test_id) REFERENCES research.test_results(run_id,id,automated_test_id);
ALTER TABLE research.agent_messages ADD CONSTRAINT agent_messages_route_check CHECK(
 (kind='requirement_clarification' AND sender='tests' AND recipient='requirements' AND requirement_id IS NOT NULL AND requirement_revision IS NOT NULL AND automated_test_id IS NULL AND test_result_id IS NULL AND script_version IS NULL AND script_revision IS NULL) OR
 (kind='script_review' AND sender='execution' AND recipient='automation' AND requirement_id IS NULL AND requirement_revision IS NULL AND automated_test_id IS NOT NULL AND test_result_id IS NOT NULL AND script_version IS NOT NULL AND script_revision IS NOT NULL));
ALTER TABLE research.agent_sessions DROP CONSTRAINT agent_sessions_child_check;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_child_check CHECK(
 (message_id IS NULL AND parent_session_id IS NULL) OR
 (message_id IS NOT NULL AND parent_session_id IS NOT NULL AND agent IN ('requirements','automation') AND automation_part_id IS NULL AND requirement_part_id IS NULL AND test_part_id IS NULL));
