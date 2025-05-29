import { CreateEventDto } from '@metrics-platform/core-shared';

export class CreateEventCommand {
  constructor(public readonly payload: CreateEventDto) {}
}
