import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
// import RedisService si quieres

@Injectable()
export class MetricsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  //async findOneByNameAndPeriod(metricName: string, period: string) {
  //  return this.dataSource.query(
  //    'SELECT * FROM daily_active_users WHERE metric_name = $1 AND period = $2 LIMIT 1',
  //    [metricName, period]
  //  );
  //}

  async findDauByDay(day: string) {
    return this.dataSource.query(
      'SELECT dau FROM daily_active_users WHERE day = $1 LIMIT 1',
      [day]
    );
  }

  async findDauRange(from: string, to: string) {
    return this.dataSource.query(
      'SELECT * FROM daily_active_users WHERE day BETWEEN $1 AND $2 ORDER BY day',
      [from, to]
    );
  }

  async findByNameAndPeriodRange(metricName: string, fromPeriod: string, toPeriod: string) {
    return this.dataSource.query(
      'SELECT * FROM metrics WHERE metric_type = $1 AND period >= $2 AND period <= $3 ORDER BY period ASC',
      [metricName, fromPeriod, toPeriod]
    );
  }

}
