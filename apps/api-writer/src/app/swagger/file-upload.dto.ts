import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileHubUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'CSV file to store, profile, and auto-classify in the File Hub.',
  })
  file!: Express.Multer.File;

  @ApiPropertyOptional({
    description: 'Optional override for the original filename. Defaults to the uploaded file name.',
  })
  fileName?: string;

  @ApiPropertyOptional({
    default: 'text/csv',
    description: 'Optional MIME type override. Defaults to the uploaded file mimetype.',
  })
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Optional JSON object with Bronze Layer tags, sent as a JSON string in multipart form.',
    example: '{"campaign":"summer"}',
  })
  tags?: string;
}

export class CsvImportUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'CSV file to upload and publish immediately to the marketing-imports queue.',
  })
  file!: Express.Multer.File;

  @ApiPropertyOptional({
    description: 'Optional override for the original filename. Defaults to the uploaded file name.',
  })
  fileName?: string;

  @ApiPropertyOptional({
    default: 'text/csv',
    description: 'Optional MIME type override. Defaults to the uploaded file mimetype.',
  })
  contentType?: string;
}
