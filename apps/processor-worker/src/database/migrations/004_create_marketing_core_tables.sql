-- EPIC 2: Core transactional schema for AI Marketing Copilot (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_currency VARCHAR(8) DEFAULT 'USD',
  timezone VARCHAR(64) DEFAULT 'UTC',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  external_account_id VARCHAR(255),
  display_name VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  import_type VARCHAR(50) NOT NULL DEFAULT 'CSV',
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  rows_total INTEGER,
  rows_processed INTEGER,
  rows_failed INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT data_imports_status_chk CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED'))
);

CREATE TABLE IF NOT EXISTS raw_import_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_id UUID NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
  storage_provider VARCHAR(30) NOT NULL,
  bucket_name VARCHAR(255) NOT NULL,
  object_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type VARCHAR(255),
  file_size_bytes BIGINT,
  checksum_sha256 VARCHAR(64),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  entity_type VARCHAR(30) NOT NULL,
  external_entity_id VARCHAR(255) NOT NULL,
  name VARCHAR(500),
  status VARCHAR(30),
  currency VARCHAR(8),
  timezone VARCHAR(64),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  normalized_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, entity_type, external_entity_id)
);

CREATE TABLE IF NOT EXISTS entity_meta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES marketing_entities(id) ON DELETE CASCADE,
  meta_key VARCHAR(100) NOT NULL,
  meta_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, meta_key)
);

CREATE TABLE IF NOT EXISTS detected_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES marketing_entities(id) ON DELETE SET NULL,
  entity_type VARCHAR(30) NOT NULL,
  fact_type VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  temporal_context JSONB NOT NULL,
  metrics_summary JSONB,
  recommendation_hint TEXT,
  analysis_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT detected_facts_severity_chk CHECK (severity IN ('INFO','WARNING','CRITICAL'))
);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  fact_id UUID REFERENCES detected_facts(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  model_name VARCHAR(120),
  model_version VARCHAR(80),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_type VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_markdown TEXT NOT NULL,
  source_fact_ids UUID[],
  model_name VARCHAR(120),
  model_version VARCHAR(80),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_currency VARCHAR(8) NOT NULL,
  quote_currency VARCHAR(8) NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  rate_date DATE NOT NULL,
  source VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_currency, quote_currency, rate_date)
);

CREATE TABLE IF NOT EXISTS project_privacy_settings (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  allow_ai_processing BOOLEAN NOT NULL DEFAULT TRUE,
  redact_pii BOOLEAN NOT NULL DEFAULT TRUE,
  retention_days INTEGER NOT NULL DEFAULT 365,
  allowed_regions TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes aligned with Epic 2 checklist
CREATE INDEX IF NOT EXISTS idx_integrations_project_id ON integrations(project_id);
CREATE INDEX IF NOT EXISTS idx_data_imports_project_id ON data_imports(project_id);
CREATE INDEX IF NOT EXISTS idx_data_imports_status ON data_imports(status);
CREATE INDEX IF NOT EXISTS idx_data_imports_created_at ON data_imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_import_files_import_id ON raw_import_files(import_id);
CREATE INDEX IF NOT EXISTS idx_marketing_entities_project_id ON marketing_entities(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_entities_entity_type ON marketing_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_marketing_entities_external_entity_id ON marketing_entities(external_entity_id);
CREATE INDEX IF NOT EXISTS idx_detected_facts_project_id ON detected_facts(project_id);
CREATE INDEX IF NOT EXISTS idx_detected_facts_entity_id ON detected_facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_detected_facts_fact_type ON detected_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_detected_facts_severity ON detected_facts(severity);
CREATE INDEX IF NOT EXISTS idx_detected_facts_created_at ON detected_facts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_project_id ON recommendations(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_project_id ON ai_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_reports_created_at ON ai_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_rate_date ON exchange_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_date ON exchange_rates(base_currency, quote_currency, rate_date DESC);

