-- Semantic & Context Layer V1.5 for AI Marketing Copilot / Atlas AI.
-- Metrics remain in ClickHouse; these PostgreSQL tables store semantic knowledge only.

CREATE TABLE IF NOT EXISTS semantic_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, entity_type, canonical_name)
);

CREATE TABLE IF NOT EXISTS semantic_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 1,
  source TEXT,
  report_type TEXT,
  import_id UUID,
  raw_file_id UUID,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, source_entity_id, target_entity_id, relationship_type, source, report_type)
);

CREATE TABLE IF NOT EXISTS context_objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  report_type TEXT,
  entity_id UUID REFERENCES semantic_entities(id) ON DELETE SET NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 1,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  is_system_generated BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, context_type, title, source, report_type, entity_id)
);

ALTER TABLE detected_facts
  ADD COLUMN IF NOT EXISTS semantic_entity_id UUID REFERENCES semantic_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_semantic_entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS context_object_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_semantic_entities_project_id ON semantic_entities(project_id);
CREATE INDEX IF NOT EXISTS idx_semantic_entities_entity_type ON semantic_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_semantic_entities_canonical_name ON semantic_entities(canonical_name);
CREATE INDEX IF NOT EXISTS idx_semantic_entities_sources ON semantic_entities USING GIN (sources);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_project_id ON semantic_relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_source_entity_id ON semantic_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_target_entity_id ON semantic_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_relationship_type ON semantic_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_source ON semantic_relationships(source);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_report_type ON semantic_relationships(report_type);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_import_id ON semantic_relationships(import_id);
CREATE INDEX IF NOT EXISTS idx_context_objects_project_id ON context_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_context_objects_context_type ON context_objects(context_type);
CREATE INDEX IF NOT EXISTS idx_context_objects_source ON context_objects(source);
CREATE INDEX IF NOT EXISTS idx_context_objects_report_type ON context_objects(report_type);
CREATE INDEX IF NOT EXISTS idx_context_objects_entity_id ON context_objects(entity_id);
CREATE INDEX IF NOT EXISTS idx_context_objects_valid_from ON context_objects(valid_from);
CREATE INDEX IF NOT EXISTS idx_context_objects_valid_to ON context_objects(valid_to);
CREATE INDEX IF NOT EXISTS idx_detected_facts_semantic_entity_id ON detected_facts(semantic_entity_id);
