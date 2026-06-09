import { Injectable } from '@nestjs/common';
import {
  DetectedFactRepository,
  SemanticEntityRepository,
  SemanticRelationshipRepository,
  type SemanticEntityRecord,
  type SemanticRelationshipRecord,
} from '@metrics-platform/marketing-infrastructure';
import { AppsFlyerSemanticAdapter } from './appsflyer-semantic.adapter';
import type { SemanticBuildInput, SemanticBuildResult, SourceSemanticAdapter } from './semantic.types';

@Injectable()
export class SemanticBuilderService {
  private readonly adapters: SourceSemanticAdapter[];

  constructor(
    private readonly semanticEntityRepository: SemanticEntityRepository,
    private readonly semanticRelationshipRepository: SemanticRelationshipRepository,
    private readonly detectedFactRepository: DetectedFactRepository,
    appsFlyerSemanticAdapter: AppsFlyerSemanticAdapter,
  ) {
    this.adapters = [appsFlyerSemanticAdapter];
  }

  async buildForImport(input: SemanticBuildInput): Promise<SemanticBuildResult> {
    const adapter = this.findAdapter(input.source);
    if (!adapter) {
      return { entitiesCreated: 0, entitiesUpdated: 0, relationshipsCreated: 0, factsLinked: 0, warnings: [`No semantic adapter is registered for source ${input.source}.`], semanticEntities: [], semanticRelationships: [] };
    }

    const warnings: string[] = [];
    const entityDrafts = await adapter.buildEntities(input);
    const entityByDraftKey = new Map<string, SemanticEntityRecord>();
    const semanticEntities: SemanticEntityRecord[] = [];

    for (const draft of entityDrafts) {
      if (!draft.canonicalName) {
        warnings.push(`Skipped semantic entity ${draft.draftKey}: canonicalName is empty.`);
        continue;
      }
      const entity = await this.semanticEntityRepository.upsertEntity({
        projectId: input.projectId,
        entityType: draft.entityType,
        canonicalName: draft.canonicalName,
        aliases: draft.aliases,
        sources: draft.sources ?? [input.source],
        metadata: { source: input.source, reportType: input.reportType, importId: input.importId, rawFileId: input.rawFileId, ...(draft.metadata ?? {}) },
        confidence: draft.confidence ?? 0.95,
      });
      entityByDraftKey.set(draft.draftKey, entity);
      semanticEntities.push(entity);
    }

    const relationshipDrafts = await adapter.buildRelationships(input);
    const semanticRelationships: SemanticRelationshipRecord[] = [];
    for (const draft of relationshipDrafts) {
      const sourceEntity = entityByDraftKey.get(draft.sourceDraftKey);
      const targetEntity = entityByDraftKey.get(draft.targetDraftKey);
      if (!sourceEntity || !targetEntity) {
        warnings.push(`Skipped relationship ${draft.relationshipType}: missing source or target entity.`);
        continue;
      }
      const relationship = await this.semanticRelationshipRepository.upsertRelationship({
        projectId: input.projectId,
        sourceEntityId: sourceEntity.id,
        targetEntityId: targetEntity.id,
        relationshipType: draft.relationshipType,
        confidence: draft.confidence ?? 0.95,
        source: draft.source ?? input.source,
        reportType: draft.reportType ?? input.reportType,
        importId: draft.importId ?? input.importId,
        rawFileId: draft.rawFileId ?? input.rawFileId,
        metadata: draft.metadata,
      });
      semanticRelationships.push(relationship);
    }

    const factsLinked = await this.linkFacts(input, semanticEntities);
    return {
      entitiesCreated: semanticEntities.length,
      entitiesUpdated: 0,
      relationshipsCreated: semanticRelationships.length,
      factsLinked,
      warnings,
      semanticEntities,
      semanticRelationships,
    };
  }

  private async linkFacts(input: SemanticBuildInput, entities: SemanticEntityRecord[]): Promise<number> {
    if (!input.importId || entities.length === 0) return 0;
    const conversionOrEvent = entities.find((entity) => entity.entityType === 'conversion_event') ?? entities.find((entity) => entity.entityType === 'event') ?? entities[0];
    const relatedEntityIds = entities.slice(0, 25).map((entity) => entity.id);
    return this.detectedFactRepository.linkFactsToSemanticEntity({
      projectId: input.projectId,
      source: input.source,
      reportType: input.reportType,
      importId: input.importId,
      semanticEntityId: conversionOrEvent.id,
      relatedSemanticEntityIds: relatedEntityIds,
    });
  }

  private findAdapter(source: string): SourceSemanticAdapter | undefined {
    return this.adapters.find((adapter) => adapter.source.toLowerCase() === source.toLowerCase());
  }
}
