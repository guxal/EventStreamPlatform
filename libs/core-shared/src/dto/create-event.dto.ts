import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  eventType!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  timestamp?: string; // ISO 8601

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  properties?: Record<string, any>;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  context?: {
    userAgent?: string;
    ip?: string;
    country?: string;
    source?: string;
    referer?: string;
  };
}
