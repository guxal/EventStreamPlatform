import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CreateEventDto } from '@metrics-platform/core-shared';
import { AppService } from './app.service';
import { ApiBody, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { CreateImportPayload, CreateProjectPayload } from './projects.types';
import type { CreateRawFilePayload, FileHubListFilters, UpdateRawFileTagsPayload } from '@metrics-platform/marketing-shared';

@ApiTags('events')
@Controller()
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
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('events')
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
  listProjects() {
    return this.appService.listProjects();
  }

  @Post('projects/:id/imports/csv')
  @ApiTags('imports')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileName'],
      properties: {
        fileName: { type: 'string' },
        contentBase64: { type: 'string' },
        contentType: { type: 'string', default: 'text/csv' },
      },
    },
  })
  createProjectImport(@Param('id') projectId: string, @Body() payload: CreateImportPayload) {
    return this.appService.createProjectImport(projectId, payload);
  }


  @Post('projects/:id/files')
  @ApiTags('file-hub')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileName', 'contentBase64'],
      properties: {
        fileName: { type: 'string' },
        contentBase64: { type: 'string' },
        mimeType: { type: 'string', default: 'text/csv' },
        tags: { type: 'object' },
      },
    },
  })
  uploadProjectFile(@Param('id') projectId: string, @Body() payload: CreateRawFilePayload) {
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
  getProjectFile(@Param('id') projectId: string, @Param('fileId') fileId: string) {
    return this.appService.getProjectFile(projectId, fileId);
  }

  @Patch('projects/:id/files/:fileId/tags')
  @ApiTags('file-hub')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['source', 'report_type'],
      properties: {
        source: { type: 'string' },
        report_type: { type: 'string' },
        tags: { type: 'object' },
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
  processProjectFile(@Param('id') projectId: string, @Param('fileId') fileId: string) {
    return this.appService.processProjectFile(projectId, fileId);
  }

  @Get('projects/:id/imports')
  @ApiTags('imports')
  listProjectImports(@Param('id') projectId: string) {
    return this.appService.listProjectImports(projectId);
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
