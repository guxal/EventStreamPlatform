import { Module } from '@nestjs/common';
import { MarketingImportPlaceholderProcessor } from './marketing-import-placeholder.processor';

@Module({
  providers: [MarketingImportPlaceholderProcessor],
})
export class MarketingImportModule {}
