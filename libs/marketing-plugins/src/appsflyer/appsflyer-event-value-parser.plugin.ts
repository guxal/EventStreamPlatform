import { Injectable } from '@nestjs/common';
import type { MappedAppsFlyerRow, ParsedEventValueRow } from './appsflyer.types';

@Injectable()
export class AppsFlyerEventValueParserPlugin {
  parse(row: MappedAppsFlyerRow): ParsedEventValueRow {
    const rawValue = row.canonical.eventValue;
    if (!rawValue) return { ...row, eventValueJson: null, eventAmount: null };

    try {
      const parsed = JSON.parse(rawValue) as Record<string, unknown>;
      const amount = this.extractAmount(parsed);
      return { ...row, eventValueJson: parsed, eventAmount: amount };
    } catch (error) {
      return {
        ...row,
        eventValueJson: null,
        eventAmount: null,
        warnings: [...row.warnings, `event_value_parse_failed:${(error as Error).message}`],
      };
    }
  }

  private extractAmount(value: Record<string, unknown>): number | null {
    const candidate = value.amount ?? value.af_revenue ?? value.revenue;
    if (candidate === null || candidate === undefined || candidate === '') return null;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
