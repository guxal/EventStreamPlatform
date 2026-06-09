-- Provider-agnostic AI output metadata for AI Marketing Copilot V1.

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS provider VARCHAR(60),
  ADD COLUMN IF NOT EXISTS source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS report_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS import_id UUID,
  ADD COLUMN IF NOT EXISTS raw_file_id UUID,
  ADD COLUMN IF NOT EXISTS raw_ai_output JSONB,
  ADD COLUMN IF NOT EXISTS generation_status VARCHAR(40) NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS related_fact_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS related_entity_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4);

ALTER TABLE ai_reports
  ADD COLUMN IF NOT EXISTS provider VARCHAR(60),
  ADD COLUMN IF NOT EXISTS source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS source_report_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS import_id UUID,
  ADD COLUMN IF NOT EXISTS raw_file_id UUID,
  ADD COLUMN IF NOT EXISTS raw_ai_output JSONB,
  ADD COLUMN IF NOT EXISTS generation_status VARCHAR(40) NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS related_fact_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS related_entity_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_recommendations_source ON recommendations(source);
CREATE INDEX IF NOT EXISTS idx_recommendations_report_type ON recommendations(report_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_generation_status ON recommendations(generation_status);
CREATE INDEX IF NOT EXISTS idx_recommendations_import_id ON recommendations(import_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_source ON ai_reports(source);
CREATE INDEX IF NOT EXISTS idx_ai_reports_source_report_type ON ai_reports(source_report_type);
CREATE INDEX IF NOT EXISTS idx_ai_reports_generation_status ON ai_reports(generation_status);
CREATE INDEX IF NOT EXISTS idx_ai_reports_import_id ON ai_reports(import_id);
