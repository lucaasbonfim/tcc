CREATE TABLE research.experiment_assessments (
 id UUID PRIMARY KEY,
 run_id UUID NOT NULL REFERENCES research.runs(id),
 snapshot_id UUID,
 verdict TEXT NOT NULL CHECK(verdict IN ('correct','partial','incorrect','inconclusive')),
 justification TEXT NOT NULL CHECK(length(justification) BETWEEN 1 AND 5000),
 reference_note TEXT NOT NULL DEFAULT '' CHECK(length(reference_note)<=5000),
 artifact JSONB NOT NULL,
 actor TEXT NOT NULL CHECK(actor='admin'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(run_id,snapshot_id) REFERENCES research.artifact_snapshots(run_id,id)
);
CREATE INDEX experiment_assessments_run ON research.experiment_assessments(run_id,created_at);
