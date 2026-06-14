CREATE TABLE IF NOT EXISTS project_source_mappings (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  report_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  column_mapping JSONB NOT NULL DEFAULT '{}',
  event_mapping JSONB NOT NULL DEFAULT '{}',
  identity_strategy JSONB NOT NULL DEFAULT '[]',
  currency TEXT NULL,
  timezone TEXT NULL,
  kpi_rules JSONB NOT NULL DEFAULT '{}',
  sensitive_fields JSONB NOT NULL DEFAULT '[]',
  data_quality_rules JSONB NOT NULL DEFAULT '{}',
  schema_signature TEXT NULL,
  header_signature TEXT NULL,
  sample_fingerprint TEXT NULL,
  ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,
  ai_confidence NUMERIC NULL,
  user_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_by TEXT NULL,
  confirmed_at TIMESTAMP NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_source_mappings_project_idx ON project_source_mappings(project_id);
CREATE INDEX IF NOT EXISTS project_source_mappings_source_idx ON project_source_mappings(source);
CREATE INDEX IF NOT EXISTS project_source_mappings_report_type_idx ON project_source_mappings(report_type);
CREATE INDEX IF NOT EXISTS project_source_mappings_status_idx ON project_source_mappings(status);
CREATE INDEX IF NOT EXISTS project_source_mappings_active_idx ON project_source_mappings(is_active);
CREATE INDEX IF NOT EXISTS project_source_mappings_schema_signature_idx ON project_source_mappings(schema_signature);
CREATE UNIQUE INDEX IF NOT EXISTS project_source_mappings_one_active_schema_idx
  ON project_source_mappings(project_id, source, report_type, schema_signature)
  WHERE is_active = TRUE;

ALTER TABLE raw_import_files ADD COLUMN IF NOT EXISTS mapping_id UUID NULL REFERENCES project_source_mappings(id) ON DELETE SET NULL;
ALTER TABLE raw_import_files ADD COLUMN IF NOT EXISTS schema_signature TEXT NULL;
ALTER TABLE raw_import_files ADD COLUMN IF NOT EXISTS mapping_status TEXT NULL;
ALTER TABLE raw_import_files ADD COLUMN IF NOT EXISTS mapping_validation JSONB NULL;
CREATE INDEX IF NOT EXISTS raw_import_files_mapping_id_idx ON raw_import_files(mapping_id);
CREATE INDEX IF NOT EXISTS raw_import_files_schema_signature_idx ON raw_import_files(schema_signature);

ALTER TABLE raw_import_files DROP CONSTRAINT IF EXISTS raw_import_files_status_chk;
ALTER TABLE raw_import_files
  ADD CONSTRAINT raw_import_files_status_chk CHECK (
    status IN (
      'UPLOADED','PROFILING','PROFILED','AUTO_CLASSIFIED','SCHEMA_DETECTED','MAPPING_REQUIRED','MAPPING_SUGGESTED','MAPPING_CONFIRMED','NEEDS_REVIEW','READY_TO_PROCESS','PROCESSING','COMPLETED','FAILED'
    )
  );
