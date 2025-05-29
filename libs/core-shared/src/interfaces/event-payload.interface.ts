export interface EventPayload {
    eventType: string;
    userId?: string;
    timestamp?: string;
    properties?: Record<string, any>;
  }
  