export function toISO(date: Date): string {
    return date.toISOString();
  }
  
  export function fromISO(isoString: string): Date {
    return new Date(isoString);
  }
  
  // Puedes agregar más helpers de fechas y periodos
  