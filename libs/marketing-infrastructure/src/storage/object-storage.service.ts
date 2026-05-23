import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

export type PutObjectInput = {
  bucketName: string;
  objectKey: string;
  contentBase64: string;
};

@Injectable()
export class ObjectStorageService {
  async putObject(input: PutObjectInput): Promise<{ uri: string; sizeBytes: number }> {
    const rootDir = process.env.MARKETING_OBJECT_STORAGE_ROOT || '/tmp/marketing-object-storage';
    const fullPath = join(rootDir, input.bucketName, input.objectKey);
    const binary = Buffer.from(input.contentBase64, 'base64');

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, binary);

    return {
      uri: `file://${fullPath}`,
      sizeBytes: binary.byteLength,
    };
  }
}
