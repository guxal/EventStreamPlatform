ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS scope_type LowCardinality(String) DEFAULT 'IMPORT';
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS scope_id Nullable(String);
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS analysis_run_id Nullable(String);
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS source Nullable(String);
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS report_type Nullable(String);
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS date_range_start Nullable(Date);
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS date_range_end Nullable(Date);
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS dimension_type Nullable(String);
ALTER TABLE marketing.marketing_metric_snapshots ADD COLUMN IF NOT EXISTS dimension_value Nullable(String);

ALTER TABLE marketing.marketing_metric_snapshots
  ADD INDEX IF NOT EXISTS idx_mms_scope scope_type TYPE set(10) GRANULARITY 64;
