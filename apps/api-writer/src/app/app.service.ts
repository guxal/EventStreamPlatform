import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateEventCommand } from '@metrics-platform/core-application';
import { CreateEventDto } from '@metrics-platform/core-shared';

@Injectable()
export class AppService {
  constructor(private readonly commandBus: CommandBus) {}

  async handleCreateEvent(dto: CreateEventDto) {
    // Puedes agregar validaciones custom aquí si lo necesitas
    return this.commandBus.execute(new CreateEventCommand(dto));
  }
}
