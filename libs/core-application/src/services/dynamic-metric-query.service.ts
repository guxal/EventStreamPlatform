import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type AggregationFn = 'sum' | 'count' | 'avg';

export interface MetricCondition {
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE';
  paramKey: string;
}

export interface DynamicMetricEntity {
  table: string;
  aggregation: {
    field: string;
    func: AggregationFn;
    alias?: string;
  };
  conditions?: MetricCondition[];
}

@Injectable()
export class DynamicMetricQueryService {
  constructor(private readonly dataSource: DataSource) {}

  buildQuery(definition: DynamicMetricEntity, params: Record<string, any>) {
    const agg = `${definition.aggregation.func.toUpperCase()}(${definition.aggregation.field})`;
    const alias = definition.aggregation.alias ?? 'value';
    let sql = `SELECT ${agg} AS ${alias} FROM ${definition.table}`;

    const values: any[] = [];
    const where: string[] = [];
    for (const cond of definition.conditions ?? []) {
      if (Object.prototype.hasOwnProperty.call(params, cond.paramKey)) {
        values.push(params[cond.paramKey]);
        where.push(`${cond.column} ${cond.operator} $${values.length}`);
      }
    }

    if (where.length) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }

    return { sql, values };
  }

  async execute(definition: DynamicMetricEntity, params: Record<string, any>) {
    const { sql, values } = this.buildQuery(definition, params);
    return this.dataSource.query(sql, values);
  }
}
