export interface FileProfile {
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  sizeBytes: number;
  checksum: string;
  isEmpty: boolean;
  warnings: string[];
}
