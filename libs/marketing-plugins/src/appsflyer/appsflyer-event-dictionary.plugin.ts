import { Injectable } from '@nestjs/common';
import { CanonicalEventType } from '@metrics-platform/marketing-shared';

const DEFAULT_EVENT_DICTIONARY: Record<string, CanonicalEventType> = {
  install: CanonicalEventType.INSTALL,
  reinstall: CanonicalEventType.REINSTALL,
  register_success: CanonicalEventType.REGISTRATION,
  user_registration_started: CanonicalEventType.REGISTRATION_STARTED,
  login_success: CanonicalEventType.LOGIN,
  login_clicked: CanonicalEventType.LOGIN,
  login_submitted: CanonicalEventType.LOGIN,
  deposit_clicked: CanonicalEventType.DEPOSIT_INTENT,
  deposit_success: CanonicalEventType.DEPOSIT,
  first_deposit_success: CanonicalEventType.FIRST_DEPOSIT,
  casino_bet_placed: CanonicalEventType.BET_PLACED,
  casino_bet_settlement_success: CanonicalEventType.BET_SETTLEMENT,
  withdraw: CanonicalEventType.WITHDRAW_INTENT,
  withdraw_success: CanonicalEventType.WITHDRAW,
  carousel_banner_viewed: CanonicalEventType.ENGAGEMENT,
  carousel_banner_clicked: CanonicalEventType.ENGAGEMENT,
  casino_game_open: CanonicalEventType.ENGAGEMENT,
  casino_game_open_live: CanonicalEventType.ENGAGEMENT,
  home_menu_clicked: CanonicalEventType.ENGAGEMENT,
  push_consent_opt_in: CanonicalEventType.CONSENT,
  push_consent_opt_out: CanonicalEventType.CONSENT,
  home_joinnow_clicked: CanonicalEventType.REGISTRATION_INTENT,
  joinnow_submitted: CanonicalEventType.REGISTRATION_STEP,
  register_submitted: CanonicalEventType.REGISTRATION_STEP,
  user_registration_step1_submitted: CanonicalEventType.REGISTRATION_STEP,
  user_registration_tnc_confirmed: CanonicalEventType.REGISTRATION_STEP,
  register_error: CanonicalEventType.REGISTRATION_ERROR,
  user_registration_failed: CanonicalEventType.REGISTRATION_ERROR,
  joinnow_exit: CanonicalEventType.REGISTRATION_DROP_OFF,
  customer_service_interaction: CanonicalEventType.SUPPORT_INTERACTION,
  first_casino_bet_placed: CanonicalEventType.FIRST_BET,
  first_withdraw_success: CanonicalEventType.FIRST_WITHDRAW,
  click: CanonicalEventType.CLICK,
  're-attribution': CanonicalEventType.REATTRIBUTION,
};

@Injectable()
export class AppsFlyerEventDictionaryPlugin {
  map(eventName: string | null | undefined): CanonicalEventType {
    const key = String(eventName ?? '').trim().toLowerCase();
    if (key.startsWith('placebet_success_')) return CanonicalEventType.SPORTS_BET_PLACED;
    return DEFAULT_EVENT_DICTIONARY[key] ?? CanonicalEventType.UNKNOWN;
  }
}
