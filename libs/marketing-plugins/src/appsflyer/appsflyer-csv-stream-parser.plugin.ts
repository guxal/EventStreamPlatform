import { Injectable } from '@nestjs/common';
import { createInterface } from 'readline';
import type { Readable } from 'stream';
import type { ParsedCsvRow } from './appsflyer.types';

@Injectable()
export class AppsFlyerCsvStreamParserPlugin {
  async *parse(stream: Readable): AsyncGenerator<ParsedCsvRow> {
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let headers: string[] | null = null;
    let rowNumber = 0;

    for await (const line of rl) {
      if (headers === null) {
        headers = this.parseCsvLine(line);
        continue;
      }
      if (line.trim() === '') continue;
      rowNumber += 1;
      const warnings: string[] = [];
      try {
        const values = this.parseCsvLine(line);
        if (values.length !== headers.length) warnings.push(`column_count_mismatch:expected_${headers.length}:actual_${values.length}`);
        const raw: Record<string, string> = {};
        headers.forEach((header, index) => { raw[header] = values[index] ?? ''; });
        yield { rowNumber, raw, warnings };
      } catch (error) {
        yield { rowNumber, raw: {}, warnings: [`malformed_row_skipped:${(error as Error).message}`] };
      }
    }
  }

  parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"'; i += 1; continue;
      }
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { result.push(current); current = ''; continue; }
      current += char;
    }
    if (inQuotes) throw new Error('unclosed_quote');
    result.push(current);
    return result;
  }
}
