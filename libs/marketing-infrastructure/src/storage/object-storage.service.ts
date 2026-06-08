import { Injectable } from '@nestjs/common';
import { createReadStream } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { Readable } from 'stream';

export type PutObjectInput = {
  bucketName: string;
  objectKey: string;
  contentBase64: string;
};

export type GetObjectStreamInput = {
  bucketName: string;
  objectKey: string;
};

@Injectable()
export class ObjectStorageService {
  private readonly rootDir = process.env.MARKETING_OBJECT_STORAGE_ROOT || '/tmp/marketing-object-storage';

  async putObject(input: PutObjectInput): Promise<{ uri: string; sizeBytes: number }> {
    const fullPath = this.resolvePath(input.bucketName, input.objectKey);
    const binary = Buffer.from(input.contentBase64, 'base64');

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, binary);

    return {
      uri: `file://${fullPath}`,
      sizeBytes: binary.byteLength,
    };
  }

  async getObjectStream(input: GetObjectStreamInput): Promise<{ stream: Readable; sizeBytes: number; uri: string }> {
    const fullPath = this.resolvePath(input.bucketName, input.objectKey);
    const metadata = await stat(fullPath);

    return {
      stream: createReadStream(fullPath),
      sizeBytes: metadata.size,
      uri: `file://${fullPath}`,
    };
  }

  private resolvePath(bucketName: string, objectKey: string): string {
    return join(this.rootDir, bucketName, objectKey);
  }
}
