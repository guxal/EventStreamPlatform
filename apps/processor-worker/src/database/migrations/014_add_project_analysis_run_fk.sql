-- Project Gold outputs link to project_analysis_runs, not import-level analysis_runs.

ALTER TABLE detected_facts
  ADD COLUMN IF NOT EXISTS project_analysis_run_id UUID REFERENCES project_analysis_runs(id) ON DELETE SET NULL;

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS project_analysis_run_id UUID REFERENCES project_analysis_runs(id) ON DELETE SET NULL;

ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS project_analysis_run_id UUID REFERENCES project_analysis_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_detected_facts_project_analysis_run_id
  ON detected_facts(project_analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_project_analysis_run_id
  ON recommendations(project_analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_project_analysis_run_id
  ON ai_reports(project_analysis_run_id);
