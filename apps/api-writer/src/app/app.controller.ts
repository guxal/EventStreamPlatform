import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateEventDto } from '@metrics-platform/core-shared';
import { AppService } from './app.service';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { CreateImportPayload, CreateProjectPayload } from './projects.types';
import { CsvImportUploadDto, FileHubUploadDto } from './swagger/file-upload.dto';
import type {
  CreateRawFilePayload,
  FileHubListFilters,
  RawImportFileTags,
  UpdateRawFileTagsPayload,
} from '@metrics-platform/marketing-shared';

type UploadedCsvFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type MultipartFileHubUploadBody = {
  fileName?: string;
  mimeType?: string;
  tags?: RawImportFileTags | string;
  contentBase64?: string;
};

type MultipartCsvImportBody = {
  fileName?: string;
  contentType?: string;
  contentBase64?: string;
};

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('events')
  @ApiTags('events')
  @ApiHeader({
    name: 'User-Agent',
    description: 'User agent of the client',
    required: false,
  })
  @ApiHeader({
    name: 'Referer',
    description: 'Referer URL',
    required: false,
  })
  @ApiOperation({ summary: 'Ingest a product/event-stream event' })
  async createEvent(
    @Body() dto: CreateEventDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referer?: string,
    @Req() request?: Request,
  ) {
    if (!dto.context) {
      dto.context = {
        userAgent,
        ip: request?.ip,
        referer,
        source: this.determineSource(referer, userAgent),
      };
    }

    return this.appService.handleCreateEvent(dto);
  }

  @Post('projects')
  @ApiTags('projects')
  @ApiOperation({ summary: 'Create an AI Marketing Copilot project' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        defaultCurrency: { type: 'string', default: 'USD' },
        timezone: { type: 'string', default: 'UTC' },
      },
    },
  })
  createProject(@Body() payload: CreateProjectPayload) {
    return this.appService.createProject(payload);
  }

  @Get('projects')
  @ApiTags('projects')
  @ApiOperation({ summary: 'List AI Marketing Copilot projects' })
  listProjects() {
    return this.appService.listProjects();
  }

  @Post('projects/:id/imports/csv')
  @ApiTags('imports')
  @ApiOperation({
    summary: 'Legacy CSV import upload that immediately publishes a processing job',
    description:
      'Upload a CSV directly with the `file` field in Swagger. The endpoint also keeps backward compatibility with JSON `contentBase64` payloads.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CsvImportUploadDto })
  @ApiResponse({ status: 201, description: 'CSV stored and processing job published.' })
  @UseInterceptors(FileInterceptor('file'))
  createProjectImport(
    @Param('id') projectId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() body: MultipartCsvImportBody,
  ) {
    const payload = this.buildCsvImportPayload(file, body);
    return this.appService.createProjectImport(projectId, payload);
  }

  @Post('projects/:id/files')
  @ApiTags('file-hub')
  @ApiOperation({
    summary: 'Upload a raw CSV file to the Bronze Layer File Hub without immediate processing',
    description:
      'Use the `file` field in Swagger to upload a CSV directly. The endpoint also keeps backward compatibility with JSON `contentBase64` payloads.',
  })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileHubUploadDto })
  @ApiResponse({ status: 201, description: 'Raw file stored, profiled, classified, and assigned a File Hub status.' })
  @UseInterceptors(FileInterceptor('file'))
  uploadProjectFile(
    @Param('id') projectId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() body: MultipartFileHubUploadBody,
  ) {
    const payload = this.buildFileHubUploadPayload(file, body);
    return this.appService.uploadProjectFile(projectId, payload);
  }

  @Get('projects/:id/files')
  @ApiTags('file-hub')
  listProjectFiles(
    @Param('id') projectId: string,
    @Query('status') status?: FileHubListFilters['status'],
    @Query('source') source?: FileHubListFilters['source'],
    @Query('report_type') reportType?: FileHubListFilters['reportType'],
  ) {
    return this.appService.listProjectFiles(projectId, { status, source, reportType });
  }

  @Get('projects/:id/files/:fileId')
  @ApiTags('file-hub')
  @ApiOperation({ summary: 'Get File Hub file detail, profile, classification, tags, and status' })
  getProjectFile(@Param('id') projectId: string, @Param('fileId') fileId: string) {
    return this.appService.getProjectFile(projectId, fileId);
  }

  @Patch('projects/:id/files/:fileId/tags')
  @ApiTags('file-hub')
  @ApiOperation({ summary: 'Manually confirm or correct File Hub source/report type tags' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['source', 'report_type'],
      properties: {
        source: { type: 'string', enum: ['APPSFLYER', 'GOOGLE_ADS', 'META_ADS', 'UNKNOWN'] },
        report_type: {
          type: 'string',
          enum: [
            'installs',
            'in_app_events',
            'non_organic_in_app_events',
            'in_app_events_postbacks',
            'conversions',
            'blocked_installs',
            'blocked_clicks',
            'blocked_in_app_events',
            'ad_revenue',
            'uninstalls',
            'campaigns',
            'keywords',
            'search_terms',
            'ads',
            'geo',
            'devices',
            'unknown',
          ],
        },
        tags: { type: 'object', additionalProperties: true },
      },
    },
  })
  updateProjectFileTags(
    @Param('id') projectId: string,
    @Param('fileId') fileId: string,
    @Body() payload: UpdateRawFileTagsPayload,
  ) {
    return this.appService.updateProjectFileTags(projectId, fileId, payload);
  }

  @Post('projects/:id/files/:fileId/process')
  @ApiTags('file-hub')
  @ApiOperation({ summary: 'Publish a READY_TO_PROCESS File Hub file to the marketing-imports queue' })
  processProjectFile(@Param('id') projectId: string, @Param('fileId') fileId: string) {
    return this.appService.processProjectFile(projectId, fileId);
  }

  @Get('projects/:id/imports')
  @ApiTags('imports')
  @ApiOperation({ summary: 'List legacy project imports' })
  listProjectImports(@Param('id') projectId: string) {
    return this.appService.listProjectImports(projectId);
  }

  private buildCsvImportPayload(file: UploadedCsvFile | undefined, body: MultipartCsvImportBody): CreateImportPayload {
    if (file) {
      return {
        fileName: body.fileName || file.originalname,
        contentBase64: file.buffer.toString('base64'),
        contentType: body.contentType || file.mimetype || 'text/csv',
      };
    }

    if (body.contentBase64 && body.fileName) {
      return {
        fileName: body.fileName,
        contentBase64: body.contentBase64,
        contentType: body.contentType || 'text/csv',
      };
    }

    throw new BadRequestException('Upload a multipart `file`, or provide JSON `fileName` and `contentBase64`.');
  }

  private buildFileHubUploadPayload(file: UploadedCsvFile | undefined, body: MultipartFileHubUploadBody): CreateRawFilePayload {
    if (file) {
      return {
        fileName: body.fileName || file.originalname,
        contentBase64: file.buffer.toString('base64'),
        mimeType: body.mimeType || file.mimetype || 'text/csv',
        tags: this.parseTags(body.tags),
      };
    }

    if (body.contentBase64 && body.fileName) {
      return {
        fileName: body.fileName,
        contentBase64: body.contentBase64,
        mimeType: body.mimeType || 'text/csv',
        tags: this.parseTags(body.tags),
      };
    }

    throw new BadRequestException('Upload a multipart `file`, or provide JSON `fileName` and `contentBase64`.');
  }

  private parseTags(tags: RawImportFileTags | string | undefined): RawImportFileTags | undefined {
    if (!tags) return undefined;
    if (typeof tags !== 'string') return tags;

    try {
      const parsed = JSON.parse(tags);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as RawImportFileTags;
      }
    } catch {
      throw new BadRequestException('tags must be a JSON object or a JSON-encoded object string.');
    }

    throw new BadRequestException('tags must be a JSON object or a JSON-encoded object string.');
  }

  private determineSource(referer?: string, userAgent?: string): string | undefined {
    if (!referer && !userAgent) return undefined;

    if (referer) {
      try {
        const url = new URL(referer);
        return url.hostname;
      } catch {
        // noop
      }
    }

    if (userAgent) {
      if (userAgent.includes('Mobile')) return 'mobile';
      if (userAgent.includes('Tablet')) return 'tablet';
      return 'desktop';
    }

    return undefined;
  }
}
