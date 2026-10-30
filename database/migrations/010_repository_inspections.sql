CREATE TABLE research.inspections (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  code_version_id UUID NOT NULL,
  artifact JSONB NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,code_version_id) REFERENCES research.code_versions(project_id,id),
  UNIQUE(code_version_id,id)
);
CREATE INDEX inspections_version_idx ON research.inspections(code_version_id,created_at DESC);
