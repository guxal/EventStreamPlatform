export class MetricPeriod {
    constructor(
      public readonly period: string // Puede ser '2025-05-27', '2025-05', '2025', etc.
    ) {}
  
    toString(): string {
      return this.period;
    }
  
    // Validaciones, comparación de periodos, etc, pueden ir aquí
  }
  