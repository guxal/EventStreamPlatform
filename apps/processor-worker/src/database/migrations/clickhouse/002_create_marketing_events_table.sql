-- Silver Layer normalized AppsFlyer events. ReplacingMergeTree keeps import_id + row_hash available
-- for logical retry idempotency; FINAL queries can collapse duplicate retry rows by the ORDER BY key.

CREATE DATABASE IF NOT EXISTS marketing;

CREATE TABLE IF NOT EXISTS marketing.marketing_events
(
  project_id String,
  integration_id Nullable(String),
  import_id String,
  raw_file_id String,
  source LowCardinality(String),
  report_type LowCardinality(String),
  event_name String,
  canonical_event_name LowCardinality(String),
  event_time Nullable(DateTime64(3, 'UTC')),
  event_date Date,
  install_time Nullable(DateTime64(3, 'UTC')),
  media_source Nullable(String),
  campaign_name Nullable(String),
  campaign_id Nullable(String),
  adset_name Nullable(String),
  adset_id Nullable(String),
  ad_name Nullable(String),
  ad_id Nullable(String),
  country_code Nullable(String),
  platform Nullable(String),
  appsflyer_id Nullable(String),
  customer_user_id Nullable(String),
  event_amount Nullable(Decimal(18, 6)),
  event_revenue Nullable(Decimal(18, 6)),
  currency Nullable(String),
  is_retargeting UInt8 DEFAULT 0,
  is_blocked UInt8 DEFAULT 0,
  blocked_reason Nullable(String),
  rejected_reason Nullable(String),
  raw_payload String DEFAULT '{}',
  row_hash String,
  created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(event_date)
ORDER BY (project_id, import_id, row_hash)
SETTINGS index_granularity = 8192;

ALTER TABLE marketing.marketing_events
  ADD INDEX IF NOT EXISTS idx_me_project project_id TYPE bloom_filter GRANULARITY 64;

ALTER TABLE marketing.marketing_events
  ADD INDEX IF NOT EXISTS idx_me_report_type report_type TYPE set(100) GRANULARITY 64;
