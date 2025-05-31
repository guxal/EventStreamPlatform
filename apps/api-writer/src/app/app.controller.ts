import { Body, Controller, Post, Headers, Req } from '@nestjs/common';
import { CreateEventDto } from '@metrics-platform/core-shared';
import { AppService } from './app.service';
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';

@ApiTags('events')
@Controller('events')
@ApiHeader({
  name: 'User-Agent',
  description: 'User agent of the client',
  required: false
})
@ApiHeader({
  name: 'Referer',
  description: 'Referer URL',
  required: false
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  async createEvent(
    @Body() dto: CreateEventDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referer?: string,
    @Req() request?: Request
  ) {
    // Si no hay contexto en el DTO, lo creamos con los valores de los headers
    if (!dto.context) {
      dto.context = {
        userAgent,
        ip: request?.ip,
        referer,
        // El source se puede determinar basado en el referer o user-agent
        source: this.determineSource(referer, userAgent)
      };
    }

    return this.appService.handleCreateEvent(dto);
  }

  private determineSource(referer?: string, userAgent?: string): string | undefined {
    if (!referer && !userAgent) return undefined;

    // Aquí puedes implementar la lógica para determinar la fuente
    // Por ejemplo, basado en el dominio del referer o el user-agent
    if (referer) {
      try {
        const url = new URL(referer);
        return url.hostname;
      } catch {
        // Si el referer no es una URL válida, ignoramos el error
      }
    }

    // Si no hay referer válido, podríamos intentar determinar la fuente del user-agent
    if (userAgent) {
      if (userAgent.includes('Mobile')) return 'mobile';
      if (userAgent.includes('Tablet')) return 'tablet';
      return 'desktop';
    }

    return undefined;
  }
}
