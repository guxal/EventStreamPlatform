import { Event } from '@metrics-platform/core-domain';

export class EventStoredEvent {
  constructor(public readonly event: Event) {}
}
