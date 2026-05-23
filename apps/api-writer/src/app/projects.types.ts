export type ProjectRecord = {
  id: string;
  name: string;
  description?: string;
  defaultCurrency: string;
  timezone: string;
  createdAt: string;
};

export type DataImportRecord = {
  id: string;
  projectId: string;
  fileName: string;
  storageProvider: 'minio' | 's3';
  bucketName: string;
  objectKey: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
};

export type CreateProjectPayload = {
  name: string;
  description?: string;
  defaultCurrency?: string;
  timezone?: string;
};

export type CreateImportPayload = {
  fileName: string;
  contentBase64?: string;
  contentType?: string;
};
