import type { AppsFlyerEventValuePayload } from './appsflyer-event-value-payload.contract';

export type AppsFlyerEventValueParseResult = {
  parsedValue: AppsFlyerEventValuePayload | null;
  amount?: number;
  revenue?: number;
  parserMode: 'JSON_PARSE' | 'REGEX_FALLBACK' | 'EMPTY_OR_INVALID';
  parseWarning?: string;
};
