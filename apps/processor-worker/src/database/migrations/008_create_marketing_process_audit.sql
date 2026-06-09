-- Process audit trail for AI Marketing Copilot imports.
-- Stores one run per queued import and one row per pipeline/service step so the full flow can be audited.

CREATE TABLE IF NOT EXISTS marketing_process_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data_import_id UUID REFERENCES data_imports(id) ON DELETE SET NULL,
  raw_file_id UUID REFERENCES raw_import_files(id) ON DELETE SET NULL,
  correlation_id VARCHAR(120),
  queue_name VARCHAR(120) NOT NULL,
  job_name VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'RUNNING',
  current_stage VARCHAR(120),
  triggered_by VARCHAR(120),
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_summary JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_process_runs_status_chk CHECK (status IN ('RUNNING','COMPLETED','FAILED'))
);

CREATE TABLE IF NOT EXISTS marketing_process_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES marketing_process_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data_import_id UUID REFERENCES data_imports(id) ON DELETE SET NULL,
  raw_file_id UUID REFERENCES raw_import_files(id) ON DELETE SET NULL,
  stage VARCHAR(120) NOT NULL,
  service_name VARCHAR(180) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'RUNNING',
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_summary JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketing_process_steps_status_chk CHECK (status IN ('RUNNING','COMPLETED','FAILED','SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_process_runs_project_id ON marketing_process_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_process_runs_data_import_id ON marketing_process_runs(data_import_id);
CREATE INDEX IF NOT EXISTS idx_marketing_process_runs_raw_file_id ON marketing_process_runs(raw_file_id);
CREATE INDEX IF NOT EXISTS idx_marketing_process_runs_status ON marketing_process_runs(status);
CREATE INDEX IF NOT EXISTS idx_marketing_process_runs_started_at ON marketing_process_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_process_steps_run_id ON marketing_process_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_marketing_process_steps_project_import ON marketing_process_steps(project_id, data_import_id);
CREATE INDEX IF NOT EXISTS idx_marketing_process_steps_stage ON marketing_process_steps(stage);
