import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }


  @Get('ui')
  getTestUi(@Res() response: Response) {
    const sourcePath = join(process.cwd(), 'apps/admin/src/assets/atlas-ai-test-ui.html');
    const distPath = join(__dirname, '..', 'assets', 'atlas-ai-test-ui.html');
    return response.sendFile(existsSync(sourcePath) ? sourcePath : distPath);
  }

  @Get('projects/:id/processes')
  listProcesses(@Param('id') projectId: string, @Query('limit') limit?: string) {
    return this.appService.listProjectProcesses(projectId, limit);
  }

  @Get('projects/:id/processes/:runId')
  getProcess(@Param('id') projectId: string, @Param('runId') runId: string) {
    return this.appService.getProjectProcess(projectId, runId);
  }
}
