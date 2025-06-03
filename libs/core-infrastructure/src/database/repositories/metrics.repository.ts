import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MetricsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findOneByNameAndPeriod(metricName: string, period: string) {
    // Ejemplo para vistas materializadas:
    return await this.dataSource.query(
      'SELECT * FROM metrics_view WHERE metric_name = $1 AND period = $2 LIMIT 1',
      [metricName, period]
    );
  }

  async findByRange(metricName: string, fromPeriod: string, toPeriod: string) {
    return await this.dataSource.query(
      'SELECT * FROM metrics_view WHERE metric_name = $1 AND period BETWEEN $2 AND $3',
      [metricName, fromPeriod, toPeriod]
    );
  }
}
