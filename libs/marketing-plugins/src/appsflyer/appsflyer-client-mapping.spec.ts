import { CanonicalEventType, MappingProfileStatus } from '@metrics-platform/marketing-shared';
import { AppsFlyerColumnMapper } from './appsflyer-column-mapper';
import { AppsFlyerEventDictionaryPlugin } from './appsflyer-event-dictionary.plugin';

const mapping: any = { status: MappingProfileStatus.ACTIVE, columnMapping: { ClientCampaign: 'campaign_name', ClientEvent: 'event_name' }, eventMapping: { vip_deposit: 'DEPOSIT' } };

describe('AppsFlyer client mapping support', () => {
  it('prioritizes client column mappings over defaults', () => {
    const mapped = new AppsFlyerColumnMapper().map({ rowNumber: 1, warnings: [], raw: { Campaign: 'default', ClientCampaign: 'client' } }, mapping);
    expect(mapped.canonical.campaignName).toBe('client');
  });

  it('prioritizes client event mappings over the default dictionary', () => {
    expect(new AppsFlyerEventDictionaryPlugin().map('vip_deposit', mapping)).toBe(CanonicalEventType.DEPOSIT);
  });
});
