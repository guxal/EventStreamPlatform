import { EventType } from '../enums/event-type.enum';
import { EventProperties } from '../value-objects/event-properties.vo';
import { EventContext } from '../value-objects/event-context.vo';

export class Event {
  constructor(
    public readonly id: string,               // UUID
    public readonly eventType: EventType,
    public readonly sessionId?: string,
    public readonly deviceId?: string,
    public readonly userId?: string,
    public readonly timestamp?: Date,
    public readonly properties?: EventProperties,
    public readonly context?: EventContext
  ) {}

  // Puedes agregar métodos de dominio si lo necesitas
}
