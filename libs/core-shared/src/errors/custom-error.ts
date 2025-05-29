export class CustomError extends Error {
    constructor(public override message: string, public code?: string) {
      super(message);
      this.name = 'CustomError';
      if (code) this.code = code;
    }
  }
  