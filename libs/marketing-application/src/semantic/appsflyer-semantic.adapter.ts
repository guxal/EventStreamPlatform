import { Injectable } from '@nestjs/common';
import { AppsFlyerEventsRepository } from '@metrics-platform/marketing-infrastructure';
import type { ContextObjectDraft, SemanticAdapterInput, SemanticEntityDraft, SemanticRelationshipDraft, SourceSemanticAdapter } from './semantic.types';

type AppsFlyerSemanticSeedEvent = {
  mediaSource?: string;
  campaignName?: string;
  campaignId?: string;
  eventName?: string;
  canonicalEventName?: string;
  events?: number;
};

const CONVERSION_EVENT_MAP: Record<string, string> = {
  register_success: 'REGISTRATION',
  deposit_success: 'DEPOSIT',
  first_deposit_success: 'FIRST_DEPOSIT',
};

const CANONICAL_EVENT_MAP: Record<string, string> = {
  ...CONVERSION_EVENT_MAP,
  casino_bet_placed: 'BET_PLACED',
  casino_bet_settlement_success: 'BET_SETTLEMENT',
};

@Injectable()
export class AppsFlyerSemanticAdapter implements SourceSemanticAdapter {
  source = 'appsflyer';

  constructor(private readonly appsFlyerEventsRepository: AppsFlyerEventsRepository) {}

  async buildEntities(input: SemanticAdapterInput): Promise<SemanticEntityDraft[]> {
    const rows = await this.seedRows(input);
    const drafts = new Map<string, SemanticEntityDraft>();

    for (const row of rows) {
      const mediaSource = this.clean(row.mediaSource);
      const campaignName = this.clean(row.campaignName);
      const eventName = this.clean(row.eventName);
      const canonicalEvent = this.canonicalEvent(row);

      if (mediaSource) {
        this.setDraft(drafts, {
          draftKey: this.mediaSourceKey(mediaSource),
          entityType: 'media_source',
          canonicalName: mediaSource,
          aliases: [mediaSource],
          sources: [this.source],
          metadata: this.metadata(input, { eventCount: row.events }),
        });
      }

      if (campaignName) {
        this.setDraft(drafts, {
          draftKey: this.campaignKey(row),
          entityType: 'campaign',
          canonicalName: campaignName,
          aliases: [campaignName, row.campaignId].filter(Boolean) as string[],
          sources: [this.source],
          metadata: this.metadata(input, { campaignId: row.campaignId, mediaSource, eventCount: row.events }),
        });
      }

      if (eventName) {
        const isConversion = Boolean(CONVERSION_EVENT_MAP[eventName.toLowerCase()]);
        this.setDraft(drafts, {
          draftKey: this.eventKey(eventName, isConversion),
          entityType: isConversion ? 'conversion_event' : 'event',
          canonicalName: eventName,
          aliases: [eventName],
          sources: [this.source],
          metadata: this.metadata(input, { canonicalEventName: canonicalEvent, eventCount: row.events }),
        });
      }

      if (canonicalEvent) {
        this.setDraft(drafts, {
          draftKey: this.canonicalEventKey(canonicalEvent),
          entityType: 'canonical_event',
          canonicalName: canonicalEvent,
          aliases: [canonicalEvent],
          sources: [this.source],
          metadata: this.metadata(input, { mappedFrom: eventName, eventCount: row.events }),
        });
      }
    }

    return Array.from(drafts.values());
  }

  async buildRelationships(input: SemanticAdapterInput): Promise<SemanticRelationshipDraft[]> {
    const rows = await this.seedRows(input);
    const drafts = new Map<string, SemanticRelationshipDraft>();

    for (const row of rows) {
      const mediaSource = this.clean(row.mediaSource);
      const campaignName = this.clean(row.campaignName);
      const eventName = this.clean(row.eventName);
      const canonicalEvent = this.canonicalEvent(row);
      const isConversion = Boolean(eventName && CONVERSION_EVENT_MAP[eventName.toLowerCase()]);

      if (mediaSource && campaignName) {
        this.setRelationship(drafts, this.mediaSourceKey(mediaSource), this.campaignKey(row), 'MEDIA_SOURCE_HAS_CAMPAIGN', input, row);
      }
      if (campaignName && eventName) {
        this.setRelationship(drafts, this.campaignKey(row), this.eventKey(eventName, isConversion), isConversion ? 'CAMPAIGN_HAS_CONVERSION_EVENT' : 'CAMPAIGN_HAS_EVENT', input, row);
      }
      if (eventName && canonicalEvent) {
        this.setRelationship(drafts, this.eventKey(eventName, isConversion), this.canonicalEventKey(canonicalEvent), 'EVENT_MAPS_TO_CANONICAL_EVENT', input, row);
      }
      if (mediaSource && eventName) {
        this.setRelationship(drafts, this.mediaSourceKey(mediaSource), this.eventKey(eventName, isConversion), 'SOURCE_HAS_EVENT', input, row);
      }
    }

    return Array.from(drafts.values());
  }

  async buildContextObjects(input: SemanticAdapterInput): Promise<ContextObjectDraft[]> {
    return [
      {
        contextType: 'SOURCE_LIMITATION',
        title: 'AppsFlyer data scope',
        content: 'AppsFlyer data represents attribution and app events. Cost-based performance metrics require a reliable paid media cost source.',
        source: this.source,
        reportType: input.reportType,
        confidence: 1,
        metadata: this.metadata(input),
      },
    ];
  }

  private async seedRows(input: SemanticAdapterInput): Promise<AppsFlyerSemanticSeedEvent[]> {
    return this.appsFlyerEventsRepository.getSemanticSeedEvents(input.projectId, {
      importId: input.importId,
      reportType: input.reportType,
    }) as Promise<AppsFlyerSemanticSeedEvent[]>;
  }

  private setDraft(drafts: Map<string, SemanticEntityDraft>, draft: SemanticEntityDraft): void {
    if (!drafts.has(draft.draftKey)) drafts.set(draft.draftKey, draft);
  }

  private setRelationship(drafts: Map<string, SemanticRelationshipDraft>, sourceDraftKey: string, targetDraftKey: string, relationshipType: string, input: SemanticAdapterInput, row: AppsFlyerSemanticSeedEvent): void {
    const key = `${sourceDraftKey}:${relationshipType}:${targetDraftKey}`;
    if (drafts.has(key)) return;
    drafts.set(key, {
      sourceDraftKey,
      targetDraftKey,
      relationshipType,
      source: this.source,
      reportType: input.reportType,
      importId: input.importId,
      rawFileId: input.rawFileId,
      confidence: 0.95,
      metadata: this.metadata(input, { eventCount: row.events }),
    });
  }

  private canonicalEvent(row: AppsFlyerSemanticSeedEvent): string | undefined {
    const eventName = this.clean(row.eventName);
    const explicitCanonical = this.clean(row.canonicalEventName);
    if (explicitCanonical) return explicitCanonical;
    return eventName ? CANONICAL_EVENT_MAP[eventName.toLowerCase()] : undefined;
  }

  private mediaSourceKey(mediaSource: string): string { return `media_source:${mediaSource.toLowerCase()}`; }
  private campaignKey(row: AppsFlyerSemanticSeedEvent): string { return `campaign:${(row.campaignId || row.campaignName || 'unknown').toLowerCase()}`; }
  private eventKey(eventName: string, isConversion: boolean): string { return `${isConversion ? 'conversion_event' : 'event'}:${eventName.toLowerCase()}`; }
  private canonicalEventKey(canonicalEvent: string): string { return `canonical_event:${canonicalEvent.toLowerCase()}`; }

  private metadata(input: SemanticAdapterInput, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { source: this.source, reportType: input.reportType, importId: input.importId, rawFileId: input.rawFileId, ...extra };
  }

  private clean(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text && text !== 'unknown' ? text : undefined;
  }
}
