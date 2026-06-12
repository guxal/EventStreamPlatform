CREATE TABLE IF NOT EXISTS ai_debug_traces (
  id UUID PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  project_id UUID NULL REFERENCES projects(id) ON DELETE SET NULL,
  import_id UUID NULL REFERENCES data_imports(id) ON DELETE SET NULL,
  raw_file_id UUID NULL REFERENCES raw_import_files(id) ON DELETE SET NULL,
  source TEXT NULL,
  report_type TEXT NULL,
  ai_flow TEXT NULL,
  prompt_type TEXT NULL,
  model TEXT NULL,
  context_summary JSONB NULL,
  sanitized_prompt JSONB NULL,
  sanitized_response TEXT NULL,
  parsed_output JSONB NULL,
  error_type TEXT NULL,
  error_message TEXT NULL,
  duration_ms INTEGER NULL,
  token_usage JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_debug_traces_correlation_idx ON ai_debug_traces (correlation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_debug_traces_project_idx ON ai_debug_traces (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_debug_traces_import_idx ON ai_debug_traces (import_id, created_at DESC);
