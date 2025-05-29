import { Body, Controller, Post } from '@nestjs/common';
import { CreateEventDto } from '@metrics-platform/core-shared';
import { AppService } from './app.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('events')
@Controller('events')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async createEvent(@Body() dto: CreateEventDto) {
    return this.appService.handleCreateEvent(dto);
  }
}
