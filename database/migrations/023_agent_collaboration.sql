CREATE TABLE research.agent_messages (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 stage_id UUID NOT NULL,
 source_attempt_id UUID NOT NULL,
 source_session_id UUID NOT NULL,
 sender TEXT NOT NULL CHECK(sender='tests'),
 recipient TEXT NOT NULL CHECK(recipient='requirements'),
 kind TEXT NOT NULL CHECK(kind='requirement_clarification'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version=1),
 request_key TEXT NOT NULL CHECK(length(request_key)=64),
 requirement_id UUID NOT NULL,
 requirement_revision INTEGER NOT NULL CHECK(requirement_revision>=0),
 request JSONB NOT NULL,
 response JSONB,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','answered')),
 review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','acknowledged','rejected','revision_requested')),
 review_justification TEXT,
 reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 answered_at TIMESTAMPTZ,
 UNIQUE(run_id,id),
 UNIQUE(run_id,request_key),
 FOREIGN KEY(run_id,stage_id) REFERENCES research.stages(run_id,id),
 FOREIGN KEY(stage_id,source_attempt_id) REFERENCES research.attempts(stage_id,id),
 FOREIGN KEY(run_id,source_session_id) REFERENCES research.agent_sessions(run_id,id),
 FOREIGN KEY(run_id,requirement_id) REFERENCES research.requirements(run_id,id),
 CHECK((status='pending' AND response IS NULL) OR (status='answered' AND response IS NOT NULL))
);
ALTER TABLE research.agent_sessions ADD COLUMN message_id UUID;
ALTER TABLE research.agent_sessions ADD COLUMN parent_session_id UUID;
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_message_fk FOREIGN KEY(run_id,message_id) REFERENCES research.agent_messages(run_id,id);
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_parent_fk FOREIGN KEY(run_id,parent_session_id) REFERENCES research.agent_sessions(run_id,id);
ALTER TABLE research.agent_sessions ADD CONSTRAINT agent_sessions_child_check CHECK(
 (message_id IS NULL AND parent_session_id IS NULL) OR
 (message_id IS NOT NULL AND parent_session_id IS NOT NULL AND agent='requirements' AND automation_part_id IS NULL AND requirement_part_id IS NULL AND test_part_id IS NULL));
ALTER TABLE research.agent_sessions DROP CONSTRAINT agent_sessions_attempt_id_key;
CREATE UNIQUE INDEX agent_sessions_root_attempt ON research.agent_sessions(attempt_id) WHERE message_id IS NULL;
CREATE UNIQUE INDEX agent_sessions_message_attempt ON research.agent_sessions(attempt_id,message_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX agent_sessions_active_message ON research.agent_sessions(message_id) WHERE message_id IS NOT NULL AND status IN ('pending','running');
DROP INDEX research.agent_sessions_one_active_whole_stage;
CREATE UNIQUE INDEX agent_sessions_one_active_whole_stage ON research.agent_sessions(stage_id)
 WHERE automation_part_id IS NULL AND requirement_part_id IS NULL AND test_part_id IS NULL AND message_id IS NULL AND status IN ('pending','running');
