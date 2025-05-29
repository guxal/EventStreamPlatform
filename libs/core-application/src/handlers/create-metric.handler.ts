import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateMetricCommand } from '../commands/create-metric.command';
import { Metric } from '@metrics-platform/core-domain';
import { v4 as uuidv4 } from 'uuid';

@CommandHandler(CreateMetricCommand)
export class CreateMetricHandler implements ICommandHandler<CreateMetricCommand> {
  async execute(command: CreateMetricCommand): Promise<Metric> {
    const id = uuidv4();
    const { payload } = command;
    const metric = new Metric(
      id,
      payload.metricName as any,
      payload.value ?? 0,
      { period: payload.period ?? 'default-period' }, // Simple value object
      payload.unit,
      payload.metadata,
      new Date(),
      new Date(),
    );
    // Aquí llamarías el repositorio para guardar la métrica (inyectado en constructor)
    // await this.metricsRepository.save(metric);
    return metric;
  }
}
