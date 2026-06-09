import type { DetectedFact } from '@metrics-platform/marketing-shared';

export type SemanticBuildInput = {
  projectId: string;
  source: string;
  reportType?: string;
  importId?: string;
  rawFileId?: string;
  facts?: DetectedFact[];
  kpis?: Record<string, unknown>;
};

export type SemanticEntityDraft = {
  draftKey: string;
  entityType: string;
  canonicalName: string;
  aliases?: string[];
  sources?: string[];
  metadata?: Record<string, unknown>;
  confidence?: number;
};

export type SemanticRelationshipDraft = {
  sourceDraftKey: string;
  targetDraftKey: string;
  relationshipType: string;
  confidence?: number;
  source?: string;
  reportType?: string;
  importId?: string;
  rawFileId?: string;
  metadata?: Record<string, unknown>;
};

export type ContextObjectDraft = {
  contextType: string;
  title: string;
  content: string;
  source?: string;
  reportType?: string;
  entityDraftKey?: string;
  entityId?: string;
  confidence?: number;
  validFrom?: string;
  validTo?: string;
  isSystemGenerated?: boolean;
  createdBy?: string;
  metadata?: Record<string, unknown>;
};

export type SemanticAdapterInput = SemanticBuildInput;

export type SemanticBuildResult = {
  entitiesCreated: number;
  entitiesUpdated: number;
  relationshipsCreated: number;
  factsLinked: number;
  warnings: string[];
  semanticEntities: unknown[];
  semanticRelationships: unknown[];
};

export type ContextBuildResult = {
  contextObjectsCreated: number;
  warnings: string[];
  contextObjects: unknown[];
};

export interface SourceSemanticAdapter {
  source: string;
  buildEntities(input: SemanticAdapterInput): Promise<SemanticEntityDraft[]>;
  buildRelationships(input: SemanticAdapterInput): Promise<SemanticRelationshipDraft[]>;
  buildContextObjects?(input: SemanticAdapterInput): Promise<ContextObjectDraft[]>;
}
