-- EPIC 3: ClickHouse time-series schema for AI Marketing Copilot

CREATE DATABASE IF NOT EXISTS marketing;

CREATE TABLE IF NOT EXISTS marketing.marketing_daily_metrics
(
  project_id String,
  integration_id Nullable(String),
  entity_id String,
  entity_type LowCardinality(String),
  date Date,
  impressions UInt64 DEFAULT 0,
  clicks UInt64 DEFAULT 0,
  cost Decimal(18, 6) DEFAULT 0,
  conversions Decimal(18, 6) DEFAULT 0,
  conversion_value Decimal(18, 6) DEFAULT 0,
  ctr Float64 DEFAULT 0,
  cpc Decimal(18, 6) DEFAULT 0,
  cpa Decimal(18, 6) DEFAULT 0,
  roas Float64 DEFAULT 0,
  conversion_rate Float64 DEFAULT 0,
  currency LowCardinality(String) DEFAULT 'USD',
  timezone LowCardinality(String) DEFAULT 'UTC',
  context_metadata String DEFAULT '{}',
  import_id Nullable(String),
  ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(date)
ORDER BY (project_id, entity_type, entity_id, date)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS marketing.marketing_metric_snapshots
(
  snapshot_id String,
  project_id String,
  integration_id Nullable(String),
  entity_id String,
  entity_type LowCardinality(String),
  as_of_date Date,
  period_start Date,
  period_end Date,
  impressions UInt64 DEFAULT 0,
  clicks UInt64 DEFAULT 0,
  cost Decimal(18, 6) DEFAULT 0,
  conversions Decimal(18, 6) DEFAULT 0,
  conversion_value Decimal(18, 6) DEFAULT 0,
  ctr Float64 DEFAULT 0,
  cpc Decimal(18, 6) DEFAULT 0,
  cpa Decimal(18, 6) DEFAULT 0,
  roas Float64 DEFAULT 0,
  conversion_rate Float64 DEFAULT 0,
  currency LowCardinality(String) DEFAULT 'USD',
  timezone LowCardinality(String) DEFAULT 'UTC',
  context_metadata String DEFAULT '{}',
  source_run_id Nullable(String),
  created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(as_of_date)
ORDER BY (project_id, entity_type, entity_id, as_of_date, snapshot_id)
SETTINGS index_granularity = 8192;

-- Data skipping indexes to optimize frequent filters
ALTER TABLE marketing.marketing_daily_metrics
  ADD INDEX IF NOT EXISTS idx_mdm_project project_id TYPE bloom_filter GRANULARITY 64;

ALTER TABLE marketing.marketing_daily_metrics
  ADD INDEX IF NOT EXISTS idx_mdm_entity_type entity_type TYPE set(100) GRANULARITY 64;

ALTER TABLE marketing.marketing_metric_snapshots
  ADD INDEX IF NOT EXISTS idx_mms_project project_id TYPE bloom_filter GRANULARITY 64;

ALTER TABLE marketing.marketing_metric_snapshots
  ADD INDEX IF NOT EXISTS idx_mms_entity_type entity_type TYPE set(100) GRANULARITY 64;
