import { Injectable } from '@nestjs/common';

const DEFAULT_MAX_CHARS = 12_000;
const FORBIDDEN_KEYS = new Set([
  'rawcsv',
  'rawrows',
  'rawpayload',
  'raw_payload',
  'fullcsvcontent',
  'csvcontent',
]);
const SENSITIVE_KEY_TOKENS = [
  'authorization',
  'api_key',
  'apikey',
  'token',
  'secret',
  'password',
  'customer_user_id',
  'customeruserid',
  'user_id',
  'userid',
  'device_id',
  'deviceid',
  'advertising_id',
  'advertisingid',
  'idfa',
  'gaid',
  'appsflyer_id',
  'appsflyerid',
];

@Injectable()
export class AiDebugSanitizerService {
  maxChars(): number {
    const parsed = Number(process.env.AI_DEBUG_MAX_CHARS ?? DEFAULT_MAX_CHARS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CHARS;
  }

  sanitizeText(input: unknown, maxChars = this.maxChars()): string {
    const text =
      typeof input === 'string' ? input : JSON.stringify(input ?? '');
    return this.truncate(this.redactScalar(text), maxChars);
  }

  sanitizeValue<T = unknown>(input: T, maxChars = this.maxChars()): T {
    const sanitized = this.sanitizeRecursive(input, 0);
    const serialized = JSON.stringify(sanitized);
    if (serialized.length <= maxChars) return sanitized as T;
    return {
      truncated: true,
      preview: this.truncate(this.redactScalar(serialized), maxChars),
    } as T;
  }

  summarizeContext(
    context: any,
    meta: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const facts = Array.isArray(context?.facts)
      ? context.facts
      : Array.isArray(context?.data?.facts)
        ? context.data.facts
        : [];
    const kpis =
      context?.kpis ?? context?.overview ?? context?.data?.overview ?? {};
    const unavailable = Array.isArray(context?.unavailableMetrics)
      ? context.unavailableMetrics
      : Array.isArray(context?.data?.unavailableMetrics)
        ? context.data.unavailableMetrics
        : [];
    const warnings = Array.isArray(context?.warnings) ? context.warnings : [];
    const sources = Array.isArray(context?.sources)
      ? context.sources
      : facts
          .map((fact: any) =>
            String(fact?.source ?? fact?.metricsSummary?.source ?? ''),
          )
          .filter(Boolean);
    const availability = context?.dataAvailability ?? {};
    return {
      ...meta,
      factsCount: facts.length,
      kpisCount:
        typeof kpis === 'object' && kpis ? Object.keys(kpis).length : 0,
      warningsCount: warnings.length,
      limitationsCount:
        unavailable.length ||
        (Array.isArray(context?.limitations) ? context.limitations.length : 0),
      hasAppsflyer:
        Boolean((availability as any).hasAppsflyer) ||
        sources.map((s: string) => s.toLowerCase()).includes('appsflyer'),
      hasGoogleAdsCost: Boolean((availability as any).hasGoogleAdsCost),
      hasRawCsv: this.containsForbiddenRawData(context),
      contextSizeChars: JSON.stringify(context ?? {}).length,
    };
  }

  promptStats(
    messages: Array<{ role: string; content: string }>,
  ): Record<string, unknown> {
    const systemPromptChars = messages
      .filter((message) => message.role === 'system')
      .reduce((sum, message) => sum + message.content.length, 0);
    const userPromptChars = messages
      .filter((message) => message.role === 'user')
      .reduce((sum, message) => sum + message.content.length, 0);
    const serialized = JSON.stringify(messages).toLowerCase();
    return {
      messagesCount: messages.length,
      systemPromptChars,
      userPromptChars,
      totalPromptChars: messages.reduce(
        (sum, message) => sum + message.content.length,
        0,
      ),
      containsRawCsv: this.containsForbiddenRawData(messages),
      containsFacts: serialized.includes('fact'),
      containsKpis: serialized.includes('kpi') || serialized.includes('metric'),
      containsLimitations:
        serialized.includes('limitation') || serialized.includes('unavailable'),
    };
  }

  containsForbiddenRawData(input: unknown): boolean {
    return this.findForbidden(input).length > 0;
  }

  findForbidden(input: unknown): string[] {
    const found = new Set<string>();
    const walk = (value: unknown, path: string, depth: number) => {
      if (depth > 12 || value == null) return;
      if (Array.isArray(value)) {
        if (
          path.toLowerCase().endsWith('samplerows') &&
          JSON.stringify(value).length > 2000
        )
          found.add(path || 'sampleRows');
        value
          .slice(0, 50)
          .forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
        return;
      }
      if (typeof value === 'string') {
        for (const key of FORBIDDEN_KEYS) {
          if (new RegExp(`\\b${key}\\b`, 'i').test(value))
            found.add(path || key);
        }
        if (/\"?sampleRows\"?\s*:/i.test(value) && value.length > 2000)
          found.add(path || 'sampleRows');
        return;
      }
      if (typeof value === 'object') {
        for (const [key, child] of Object.entries(
          value as Record<string, unknown>,
        )) {
          const normalized = key.toLowerCase();
          if (FORBIDDEN_KEYS.has(normalized))
            found.add(path ? `${path}.${key}` : key);
          if (
            normalized === 'samplerows' &&
            JSON.stringify(child).length > 2000
          )
            found.add(path ? `${path}.${key}` : key);
          walk(child, path ? `${path}.${key}` : key, depth + 1);
        }
      }
    };
    walk(input, '', 0);
    return Array.from(found);
  }

  private sanitizeRecursive(input: unknown, depth: number): unknown {
    if (depth > 10) return '[TRUNCATED]';
    if (typeof input === 'string') return this.sanitizeText(input);
    if (typeof input !== 'object' || input === null) return input;
    if (Array.isArray(input))
      return input
        .slice(0, 50)
        .map((item) => this.sanitizeRecursive(item, depth + 1));
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>,
    )) {
      const normalized = key.toLowerCase();
      if (FORBIDDEN_KEYS.has(normalized) || normalized === 'samplerows') {
        output[key] = '[REDACTED_RAW_PAYLOAD]';
      } else if (
        SENSITIVE_KEY_TOKENS.some((token) => normalized.includes(token))
      ) {
        output[key] =
          normalized.includes('device') ||
          normalized.includes('idfa') ||
          normalized.includes('gaid')
            ? '[REDACTED_DEVICE_ID]'
            : '[REDACTED_CUSTOMER_USER_ID]';
      } else {
        output[key] = this.sanitizeRecursive(value, depth + 1);
      }
    }
    return output;
  }

  private redactScalar(text: string): string {
    return text
      .replace(/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]')
      .replace(
        /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
        'Bearer [REDACTED_BEARER_TOKEN]',
      )
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
      .replace(/\+?\d[\d .()\-]{8,}\d/g, '[REDACTED_PHONE]')
      .replace(
        /\b(?:customer[_-]?user[_-]?id|user[_-]?id)\s*[:=]\s*['\"]?[^,'\"\s}]+/gi,
        'customer_user_id:[REDACTED_CUSTOMER_USER_ID]',
      )
      .replace(
        /\b(?:device[_-]?id|advertising[_-]?id|idfa|gaid|appsflyer[_-]?id)\s*[:=]\s*['\"]?[^,'\"\s}]+/gi,
        'device_id:[REDACTED_DEVICE_ID]',
      );
  }

  private truncate(text: string, maxChars: number): string {
    return text.length > maxChars
      ? `${text.slice(0, maxChars)}[TRUNCATED]`
      : text;
  }
}
