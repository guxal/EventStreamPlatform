-- Bronze Layer File Hub / Import Hub metadata for AI Marketing Copilot V1

ALTER TABLE raw_import_files
  ALTER COLUMN import_id DROP NOT NULL;

ALTER TABLE raw_import_files
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS data_import_id UUID REFERENCES data_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_file_name TEXT,
  ADD COLUMN IF NOT EXISTS storage_uri TEXT,
  ADD COLUMN IF NOT EXISTS bucket VARCHAR(255),
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS checksum VARCHAR(64),
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255),
  ADD COLUMN IF NOT EXISTS row_count INTEGER,
  ADD COLUMN IF NOT EXISTS headers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sample_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS report_type VARCHAR(80) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS error_summary JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE raw_import_files
SET data_import_id = COALESCE(data_import_id, import_id),
    original_file_name = COALESCE(original_file_name, original_filename),
    bucket = COALESCE(bucket, bucket_name),
    size_bytes = COALESCE(size_bytes, file_size_bytes),
    checksum = COALESCE(checksum, checksum_sha256),
    mime_type = COALESCE(mime_type, content_type),
    updated_at = COALESCE(updated_at, created_at, NOW());

ALTER TABLE raw_import_files
  DROP CONSTRAINT IF EXISTS raw_import_files_status_chk;

ALTER TABLE raw_import_files
  ADD CONSTRAINT raw_import_files_status_chk CHECK (
    status IN (
      'UPLOADED',
      'PROFILING',
      'PROFILED',
      'AUTO_CLASSIFIED',
      'NEEDS_REVIEW',
      'READY_TO_PROCESS',
      'PROCESSING',
      'COMPLETED',
      'FAILED'
    )
  );

ALTER TABLE raw_import_files
  DROP CONSTRAINT IF EXISTS raw_import_files_source_chk;

ALTER TABLE raw_import_files
  ADD CONSTRAINT raw_import_files_source_chk CHECK (source IN ('APPSFLYER','GOOGLE_ADS','META_ADS','UNKNOWN'));

CREATE INDEX IF NOT EXISTS idx_raw_import_files_project_id ON raw_import_files(project_id);
CREATE INDEX IF NOT EXISTS idx_raw_import_files_status ON raw_import_files(status);
CREATE INDEX IF NOT EXISTS idx_raw_import_files_source ON raw_import_files(source);
CREATE INDEX IF NOT EXISTS idx_raw_import_files_report_type ON raw_import_files(report_type);
CREATE INDEX IF NOT EXISTS idx_raw_import_files_created_at ON raw_import_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_import_files_checksum ON raw_import_files(checksum);
