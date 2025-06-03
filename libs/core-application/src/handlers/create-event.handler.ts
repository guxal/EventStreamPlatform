import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateEventCommand } from '../commands/create-event.command';
import { EventRepository } from '@metrics-platform/core-infrastructure';
import { Event, EventContext, EventProperties } from '@metrics-platform/core-domain';
import { EventProducerService } from '@metrics-platform/core-infrastructure';
import { v4 as uuidv4 } from 'uuid';


@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    private readonly eventsRepository: EventRepository,
    private readonly eventProducer: EventProducerService,
  ) {}

  async execute(command: CreateEventCommand): Promise<Event> {
    // Aquí deberías mapear el DTO a la entidad Event y retornar el resultado,
    // normalmente delegando a un service (inyectado) que lo guarda en el repositorio
    const id = uuidv4();
    const { payload } = command;
    const event = new Event(
      id,
      payload.eventType as any,
      payload.sessionId,
      payload.deviceId,
      payload.userId,
      payload.timestamp ? new Date(payload.timestamp) : new Date(),
      new EventProperties(payload.properties ?? {}),
      new EventContext(payload.context ?? {})
    );

    // Map Event to a plain object compatible with EventOrmEntity
    const eventToSave = {
      id: event.id,
      eventType: event.eventType,
      sessionId: event.sessionId,
      deviceId: event.deviceId,
      userId: event.userId,
      timestamp: event.timestamp,
      properties: event.properties,
      context: event.context
        ? {
            userAgent: event.context.getUserAgent(),
            ip: event.context.getIp(),
            country: event.context.getCountry(),
            source: event.context.getSource(),
            referer: event.context.getReferer(),
          }
        : undefined,
    };

    // Aquí llamarías un repositorio para guardar el evento
    await this.eventsRepository.save(eventToSave);

    // Publícalo en la cola
    await this.eventProducer.publishEvent(eventToSave);

    return event;
  }
}
