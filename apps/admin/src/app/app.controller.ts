import { Controller, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
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
