import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateEventCommand } from '../commands/create-event.command';
import { EventRepository } from '@metrics-platform/core-infrastructure';
import { Event, EventProperties } from '@metrics-platform/core-domain';
import { v4 as uuidv4 } from 'uuid';


@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(private readonly eventsRepository: EventRepository) {}

  async execute(command: CreateEventCommand): Promise<Event> {
    // Aquí deberías mapear el DTO a la entidad Event y retornar el resultado,
    // normalmente delegando a un service (inyectado) que lo guarda en el repositorio
    const id = uuidv4();
    const { payload } = command;
    const event = new Event(
      id,
      payload.eventType as any,
      payload.userId,
      payload.timestamp ? new Date(payload.timestamp) : new Date(),
      new EventProperties(payload.properties ?? {}),
    );
    // Aquí llamarías un repositorio para guardar el evento
    await this.eventsRepository.save(event);
    return event;
  }
}
