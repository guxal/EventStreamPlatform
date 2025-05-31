export class EventContext {
  constructor(
    private readonly props: {
      userAgent?: string;
      ip?: string;
      country?: string;
      source?: string;
      referer?: string;
    }
  ) {}

  getUserAgent(): string | undefined {
    return this.props.userAgent;
  }

  getIp(): string | undefined {
    return this.props.ip;
  }

  getCountry(): string | undefined {
    return this.props.country;
  }

  getSource(): string | undefined {
    return this.props.source;
  }

  getReferer(): string | undefined {
    return this.props.referer;
  }

  getAll(): {
    userAgent?: string;
    ip?: string;
    country?: string;
    source?: string;
    referer?: string;
  } {
    return this.props;
  }
} 