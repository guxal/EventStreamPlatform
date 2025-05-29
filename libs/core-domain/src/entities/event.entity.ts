import { EventType } from '../enums/event-type.enum';
import { EventProperties } from '../value-objects/event-properties.vo';

export class Event {
  constructor(
    public readonly id: string,               // UUID
    public readonly eventType: EventType,
    public readonly userId?: string,
    public readonly timestamp?: Date,
    public readonly properties?: EventProperties,
  ) {}

  // Puedes agregar métodos de dominio si lo necesitas
}
