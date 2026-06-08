import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { startQueueConsumer } from '../queue/queue.consumer';
import { DataSource, ReportType, type MarketingImportProcessJobPayload } from '@metrics-platform/marketing-shared';

@Injectable()
export class MarketingImportPlaceholderProcessor implements OnModuleInit {
  private readonly logger = new Logger(MarketingImportPlaceholderProcessor.name);

  onModuleInit() {
    startQueueConsumer('marketing-imports', async (payload: MarketingImportProcessJobPayload) => {
      this.validatePayload(payload);
      this.logger.log(
        `Validated File Hub import payload rawFileId=${payload.rawFileId} dataImportId=${payload.dataImportId} source=${payload.source} reportType=${payload.reportType}`,
      );
    });
  }

  private validatePayload(payload: MarketingImportProcessJobPayload): void {
    const required = ['projectId', 'rawFileId', 'dataImportId', 'storageUri', 'source', 'reportType', 'triggeredBy'] as const;
    for (const field of required) {
      if (!payload[field]) {
        throw new Error(`Invalid process-marketing-import payload: missing ${field}`);
      }
    }

    if (payload.source === DataSource.UNKNOWN || payload.reportType === ReportType.UNKNOWN) {
      throw new Error('Invalid process-marketing-import payload: unknown source/reportType cannot be processed');
    }
  }
}
