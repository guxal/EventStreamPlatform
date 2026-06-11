import { Injectable } from '@nestjs/common';

export type AiQuestionIntent = 'PROJECT_SUMMARY' | 'IMPORT_SUMMARY' | 'TOP_FACTS' | 'EVENT_PERFORMANCE' | 'MEDIA_SOURCE_PERFORMANCE' | 'CAMPAIGN_PERFORMANCE' | 'BLOCKED_TRAFFIC' | 'RECOMMENDATIONS' | 'REPORT_SUMMARY' | 'DATA_QUALITY' | 'UNAVAILABLE_METRICS' | 'SEMANTIC_CONTEXT' | 'UNKNOWN';

@Injectable()
export class AiQuestionIntentRouter {
  route(question: string): AiQuestionIntent {
    const q = question.toLowerCase();
    if (/\b(roas|cpa|cac|cost|spend|profit|profitability)\b/.test(q)) return 'UNAVAILABLE_METRICS';
    if (/\b(fact|facts|problem|problems|problema|issue|issues|hallazgo)\b/.test(q)) return 'TOP_FACTS';
    if (/media source|fuente|publisher|channel/.test(q)) return 'MEDIA_SOURCE_PERFORMANCE';
    if (/campaign|campaña/.test(q)) return 'CAMPAIGN_PERFORMANCE';
    if (/blocked|fraud|bot|rejected|traffic quality/.test(q)) return 'BLOCKED_TRAFFIC';
    if (/recommend|recommendation|recomienda|next step/.test(q)) return 'RECOMMENDATIONS';
    if (/report|informe/.test(q)) return 'REPORT_SUMMARY';
    if (/data quality|quality|warning|warnings/.test(q)) return 'DATA_QUALITY';
    if (/semantic|context|entity|relationship/.test(q)) return 'SEMANTIC_CONTEXT';
    if (/import|upload|file/.test(q)) return 'IMPORT_SUMMARY';
    if (/event|deposit|ftd|registration|volume/.test(q)) return 'EVENT_PERFORMANCE';
    if (/summary|overview|resumen/.test(q)) return 'PROJECT_SUMMARY';
    return 'UNKNOWN';
  }
}
