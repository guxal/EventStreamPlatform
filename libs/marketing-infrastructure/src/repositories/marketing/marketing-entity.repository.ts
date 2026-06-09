import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EntityType, type NormalizedAppsFlyerEvent } from '@metrics-platform/marketing-shared';

@Injectable()
export class MarketingEntityRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async upsertAppsFlyerDimensions(projectId: string, events: NormalizedAppsFlyerEvent[]): Promise<void> {
    const seen = new Set<string>();
    for (const event of events) {
      await this.upsertDimension(projectId, EntityType.ACCOUNT, event.mediaSource ?? undefined, event.mediaSource ?? undefined, { source: event.source, dimension: 'media_source' }, seen);
      await this.upsertDimension(projectId, EntityType.CAMPAIGN, event.campaignId ?? event.campaignName ?? undefined, event.campaignName ?? event.campaignId ?? undefined, { source: event.source, mediaSource: event.mediaSource }, seen);
    }
  }

  private async upsertDimension(projectId: string, entityType: EntityType, externalId: string | undefined, name: string | undefined, payload: Record<string, unknown>, seen: Set<string>): Promise<void> {
    if (!externalId) return;
    const key = `${entityType}:${externalId}`;
    if (seen.has(key)) return;
    seen.add(key);
    await this.dataSource.query(
      `INSERT INTO marketing_entities (project_id, entity_type, external_entity_id, name, normalized_payload, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
       ON CONFLICT (project_id, entity_type, external_entity_id)
       DO UPDATE SET name = COALESCE(EXCLUDED.name, marketing_entities.name), normalized_payload = EXCLUDED.normalized_payload, last_seen_at = NOW(), updated_at = NOW()`,
      [projectId, entityType, externalId, name ?? externalId, JSON.stringify(payload)],
    );
  }
}
