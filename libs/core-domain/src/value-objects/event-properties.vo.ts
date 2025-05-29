export class EventProperties {
    constructor(
      private readonly props: Record<string, any>
    ) {}
  
    get(key: string): any {
      return this.props[key];
    }
  
    getAll(): Record<string, any> {
      return this.props;
    }
  
    // Puedes añadir validaciones específicas según el tipo de evento si lo necesitas
  }
  