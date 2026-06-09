import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import * as readline from 'readline';
import type { Readable } from 'stream';
import type { FileProfile } from '@metrics-platform/marketing-shared';
import { ObjectStorageService } from '@metrics-platform/marketing-infrastructure';

const DEFAULT_SAMPLE_SIZE = 5;
const SUSPICIOUS_EXPORT_LIMITS = new Set([200000, 500000, 1000000]);

@Injectable()
export class FileProfilerService {
  constructor(private readonly objectStorageService: ObjectStorageService) {}

  async profileStoredCsv(input: { bucketName: string; objectKey: string; sampleSize?: number }): Promise<FileProfile> {
    const { stream, sizeBytes } = await this.objectStorageService.getObjectStream(input);
    return this.profileCsvStream(stream, sizeBytes, input.sampleSize ?? DEFAULT_SAMPLE_SIZE);
  }

  async profileCsvStream(stream: Readable, sizeBytes: number, sampleSize = DEFAULT_SAMPLE_SIZE): Promise<FileProfile> {
    const hash = createHash('sha256');
    const hashingStream = stream.on('data', (chunk: Buffer | string) => hash.update(chunk));
    const rl = readline.createInterface({ input: hashingStream, crlfDelay: Infinity });
    const warnings: string[] = [];
    const sampleRows: Record<string, string>[] = [];
    let headers: string[] = [];
    let rowCount = 0;
    let lineNumber = 0;

    for await (const line of rl) {
      if (lineNumber === 0) {
        headers = this.parseCsvLine(line).map((header) => header.trim()).filter((header) => header.length > 0);
      } else if (line.trim().length > 0) {
        rowCount += 1;
        if (sampleRows.length < sampleSize) {
          sampleRows.push(this.mapRow(headers, this.parseCsvLine(line)));
        }
      }
      lineNumber += 1;
    }

    if (headers.length === 0 || rowCount === 0) {
      warnings.push('EMPTY_OR_HEADER_ONLY_FILE');
    }

    if (SUSPICIOUS_EXPORT_LIMITS.has(rowCount)) {
      warnings.push(`SUSPICIOUS_EXPORT_LIMIT_${rowCount}`);
    }

    return {
      headers,
      rowCount,
      sampleRows,
      sizeBytes,
      checksum: hash.digest('hex'),
      isEmpty: headers.length === 0 || rowCount === 0,
      warnings,
    };
  }

  private mapRow(headers: string[], values: string[]): Record<string, string> {
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }
}
