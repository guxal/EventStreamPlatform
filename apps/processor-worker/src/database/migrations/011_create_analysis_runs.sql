-- Explicit AI analysis runs for regenerated facts-first recommendations/reports.

CREATE TABLE IF NOT EXISTS analysis_runs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT,
  report_type TEXT,
  import_id UUID REFERENCES data_imports(id) ON DELETE SET NULL,
  raw_file_id UUID REFERENCES raw_import_files(id) ON DELETE SET NULL,
  analysis_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL,
  triggered_by TEXT,
  input_context_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_stage TEXT,
  error_message TEXT,
  error_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analysis_runs_status_chk CHECK (status IN ('QUEUED','RUNNING','COMPLETED','COMPLETED_WITH_WARNINGS','FAILED','SKIPPED')),
  CONSTRAINT analysis_runs_type_chk CHECK (analysis_type IN ('FULL_REPORT','RECOMMENDATIONS_ONLY','REPORT_ONLY','FACT_EXPLANATION','IMPORT_SUMMARY','PROJECT_SUMMARY'))
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_project_id ON analysis_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_source ON analysis_runs(source);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_report_type ON analysis_runs(report_type);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_import_id ON analysis_runs(import_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_raw_file_id ON analysis_runs(raw_file_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_status ON analysis_runs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_analysis_type ON analysis_runs(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON analysis_runs(created_at);

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS analysis_run_id UUID REFERENCES analysis_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS analysis_run_id UUID REFERENCES analysis_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_recommendations_analysis_run_id ON recommendations(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_analysis_run_id ON ai_reports(analysis_run_id);
