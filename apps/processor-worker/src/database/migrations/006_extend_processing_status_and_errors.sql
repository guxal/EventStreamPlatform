-- AppsFlyer processing status/error context for AI Marketing Copilot V1.

ALTER TABLE data_imports
  ADD COLUMN IF NOT EXISTS error_stage VARCHAR(80),
  ADD COLUMN IF NOT EXISTS error_summary JSONB;

ALTER TABLE data_imports
  DROP CONSTRAINT IF EXISTS data_imports_status_chk;

ALTER TABLE data_imports
  ADD CONSTRAINT data_imports_status_chk CHECK (
    status IN ('PENDING','PROCESSING','PROCESSING_BRONZE','PROCESSING_SILVER','PROCESSING_GOLD','GENERATING_AI_OUTPUTS','COMPLETED','FAILED')
  );

ALTER TABLE raw_import_files
  ADD COLUMN IF NOT EXISTS error_stage VARCHAR(80);
