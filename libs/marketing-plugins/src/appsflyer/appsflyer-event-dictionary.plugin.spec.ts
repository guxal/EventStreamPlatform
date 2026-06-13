import { CanonicalEventType } from '@metrics-platform/marketing-shared';
import { AppsFlyerEventDictionaryPlugin } from './appsflyer-event-dictionary.plugin';

describe('AppsFlyerEventDictionaryPlugin', () => {
  const plugin = new AppsFlyerEventDictionaryPlugin();

  it('maps newly supported deterministic event names', () => {
    expect(plugin.map('login_submitted')).toBe(CanonicalEventType.LOGIN);
    expect(plugin.map('register_submitted')).toBe(CanonicalEventType.REGISTRATION_STEP);
    expect(plugin.map('first_withdraw_success')).toBe(CanonicalEventType.FIRST_WITHDRAW);
  });

  it('maps placebet_success wildcard events explicitly', () => {
    expect(plugin.map('placebet_success_ice_hockey')).toBe(CanonicalEventType.SPORTS_BET_PLACED);
  });
});
