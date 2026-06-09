import { Injectable } from '@nestjs/common';
import { CanonicalEventType } from '@metrics-platform/marketing-shared';

const DEFAULT_EVENT_DICTIONARY: Record<string, CanonicalEventType> = {
  install: CanonicalEventType.INSTALL,
  reinstall: CanonicalEventType.REINSTALL,
  register_success: CanonicalEventType.REGISTRATION,
  user_registration_started: CanonicalEventType.REGISTRATION_STARTED,
  login_success: CanonicalEventType.LOGIN,
  login_clicked: CanonicalEventType.LOGIN,
  deposit_clicked: CanonicalEventType.DEPOSIT_INTENT,
  deposit_success: CanonicalEventType.DEPOSIT,
  first_deposit_success: CanonicalEventType.FIRST_DEPOSIT,
  casino_bet_placed: CanonicalEventType.BET_PLACED,
  casino_bet_settlement_success: CanonicalEventType.BET_SETTLEMENT,
  withdraw: CanonicalEventType.WITHDRAW_INTENT,
  withdraw_success: CanonicalEventType.WITHDRAW,
  carousel_banner_viewed: CanonicalEventType.ENGAGEMENT,
  casino_game_open: CanonicalEventType.ENGAGEMENT,
  push_consent_opt_in: CanonicalEventType.CONSENT,
  push_consent_opt_out: CanonicalEventType.CONSENT,
};

@Injectable()
export class AppsFlyerEventDictionaryPlugin {
  map(eventName: string | null | undefined): CanonicalEventType {
    const key = String(eventName ?? '').trim().toLowerCase();
    return DEFAULT_EVENT_DICTIONARY[key] ?? CanonicalEventType.UNKNOWN;
  }
}
