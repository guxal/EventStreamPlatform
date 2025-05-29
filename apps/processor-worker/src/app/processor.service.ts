import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommandBus } from '@nestjs/cqrs';
// Puedes importar y usar use-cases/commands que ya tengas, ej:
import { CalculateMetricsUseCase } from '@metrics-platform/core-application';

@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);

  // Ejecuta cada 5 minutos (ajusta el cron según necesidad)
  @Cron('*/5 * * * *')
  async handleMetricsCalculation() {
    this.logger.log('Starting scheduled metrics calculation...');
    // Aquí ejecutas el use-case o comandos para calcular métricas
    // Por ejemplo:
    // await this.commandBus.execute(new CalculateMetricsCommand());
    // O si usas un use-case directo:
    // await this.calculateMetricsUseCase.execute();

    // Temporal: Loguear que el worker está corriendo
    this.logger.log('Metrics calculation job executed!');
  }

  // Puedes agregar otros jobs para distintas métricas si lo deseas
}
