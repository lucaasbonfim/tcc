CREATE SCHEMA IF NOT EXISTS research;

CREATE TABLE research.projects (
  id UUID PRIMARY KEY,
  name VARCHAR(180) NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  repository_url TEXT NOT NULL CHECK (repository_url ~ '^https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  requested_ref VARCHAR(255) NOT NULL,
  technical_notes TEXT NOT NULL DEFAULT '',
  complementary_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE research.code_versions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES research.projects(id),
  repository_url TEXT NOT NULL,
  requested_ref TEXT NOT NULL,
  commit_sha CHAR(40) NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  inspection JSONB NOT NULL DEFAULT '{}',
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, id)
);
CREATE INDEX code_versions_project_idx ON research.code_versions(project_id, resolved_at DESC);

CREATE TABLE research.documents (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES research.projects(id),
  name VARCHAR(180) NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  media_type TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  artifact JSONB NOT NULL,
  extraction JSONB NOT NULL,
  page_count INTEGER NOT NULL CHECK (page_count > 0),
  warnings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name, version),
  UNIQUE(project_id, id)
);

CREATE TABLE research.runs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES research.projects(id),
  code_version_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','awaiting_review','completed','failed','cancelled')),
  snapshot JSONB NOT NULL,
  model TEXT NOT NULL,
  parameters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  FOREIGN KEY (project_id, code_version_id) REFERENCES research.code_versions(project_id, id),
  UNIQUE(project_id, id)
);
CREATE UNIQUE INDEX runs_one_active_project_idx ON research.runs(project_id)
  WHERE status IN ('pending','running','awaiting_review');
CREATE INDEX runs_project_idx ON research.runs(project_id, created_at DESC);

CREATE TABLE research.run_documents (
  project_id UUID NOT NULL,
  run_id UUID NOT NULL,
  document_id UUID NOT NULL,
  PRIMARY KEY (run_id, document_id),
  FOREIGN KEY(project_id, run_id) REFERENCES research.runs(project_id, id),
  FOREIGN KEY(project_id, document_id) REFERENCES research.documents(project_id, id)
);

CREATE TABLE research.stages (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES research.runs(id),
  agent TEXT NOT NULL CHECK (agent IN ('requirements','tests','execution','evaluation')),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  status TEXT NOT NULL CHECK (status IN ('blocked','pending','running','awaiting_review','completed','failed','not_supported','cancelled')),
  instruction_version TEXT NOT NULL,
  instruction TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 3),
  lease_until TIMESTAMPTZ,
  lease_token UUID,
  message TEXT,
  UNIQUE(run_id, agent),
  UNIQUE(run_id, position),
  UNIQUE(run_id, id)
);
CREATE INDEX stages_pending_idx ON research.stages(status, lease_until);

CREATE TABLE research.attempts (
  id UUID PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES research.stages(id),
  number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 3),
  status TEXT NOT NULL CHECK(status IN ('running','completed','failed','interrupted')),
  input JSONB,
  output JSONB,
  provider_metadata JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER CHECK(duration_ms >= 0),
  UNIQUE(stage_id, number)
);

CREATE TABLE research.requirements (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES research.runs(id),
  code VARCHAR(40) NOT NULL,
  content JSONB NOT NULL CHECK(jsonb_typeof(content) = 'object'),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  UNIQUE(run_id, code),
  UNIQUE(run_id, id)
);
CREATE TABLE research.test_cases (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES research.runs(id),
  code VARCHAR(40) NOT NULL,
  content JSONB NOT NULL CHECK(jsonb_typeof(content) = 'object'),
  artifact_type TEXT NOT NULL DEFAULT 'textual' CHECK(artifact_type = 'textual'),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  UNIQUE(run_id, code),
  UNIQUE(run_id, id)
);
CREATE TABLE research.test_requirements (
  run_id UUID NOT NULL,
  test_case_id UUID NOT NULL,
  requirement_id UUID NOT NULL,
  PRIMARY KEY(test_case_id, requirement_id),
  FOREIGN KEY(run_id, test_case_id) REFERENCES research.test_cases(run_id, id),
  FOREIGN KEY(run_id, requirement_id) REFERENCES research.requirements(run_id, id)
);
CREATE TABLE research.reviews (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES research.runs(id),
  stage_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('requirement','test_case','stage','run')),
  entity_id UUID NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approved','rejected','cancelled','retry')),
  justification TEXT NOT NULL CHECK(length(trim(justification)) > 0),
  before_value JSONB,
  after_value JSONB,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(run_id, stage_id) REFERENCES research.stages(run_id, id)
);
CREATE INDEX reviews_run_idx ON research.reviews(run_id, created_at);
