-- Project Gold Engine / project-level AppsFlyer analysis.

CREATE TABLE IF NOT EXISTS project_analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  status TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  correlation_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_stage TEXT,
  error_message TEXT,
  error_summary JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_analysis_runs_status_chk CHECK (status IN ('PENDING','PROCESSING','COMPUTING_KPIS','GENERATING_FACTS','GENERATING_AI_SUMMARY','COMPLETED','FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_project_analysis_runs_project ON project_analysis_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_analysis_runs_source ON project_analysis_runs(source);
CREATE INDEX IF NOT EXISTS idx_project_analysis_runs_status ON project_analysis_runs(status);
CREATE INDEX IF NOT EXISTS idx_project_analysis_runs_created ON project_analysis_runs(created_at DESC);

ALTER TABLE detected_facts
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'IMPORT',
  ADD COLUMN IF NOT EXISTS scope_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS report_type TEXT,
  ADD COLUMN IF NOT EXISTS date_range_start DATE,
  ADD COLUMN IF NOT EXISTS date_range_end DATE;

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'IMPORT',
  ADD COLUMN IF NOT EXISTS scope_id UUID,
  ADD COLUMN IF NOT EXISTS date_range_start DATE,
  ADD COLUMN IF NOT EXISTS date_range_end DATE;

ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'IMPORT',
  ADD COLUMN IF NOT EXISTS scope_id UUID,
  ADD COLUMN IF NOT EXISTS date_range_start DATE,
  ADD COLUMN IF NOT EXISTS date_range_end DATE;

CREATE INDEX IF NOT EXISTS idx_detected_facts_project_scope ON detected_facts(project_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_detected_facts_project_source_dates ON detected_facts(project_id, source, date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_recommendations_project_scope ON recommendations(project_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_project_scope ON ai_reports(project_id, scope_type, scope_id);
