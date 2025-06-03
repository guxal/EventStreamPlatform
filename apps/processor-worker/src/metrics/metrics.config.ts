export interface MetricConfig {
    name: string;
    mode: 'batch' | 'realtime' | 'hybrid';
    schedule?: string; // cron
    queue?: string;    // realtime
    plugin: any;       // clase del plugin (constructor, token DI)
    method: string;    // método a invocar ('refreshDailyActiveUsers', 'processDauRealtime', etc)
    enabled: boolean;
  }
  
  import { DAUMetricPlugin } from './plugins/dau.metric';
  //import { RetentionMetricPlugin } from './plugins/retention.metric';
  
  export const METRICS_CONFIG: MetricConfig[] = [
    {
      name: 'dau-batch',
      mode: 'batch',
      schedule: '0 * * * *', // cada hora
      plugin: DAUMetricPlugin,
      method: 'refreshDailyActiveUsers',
      enabled: true,
    },
    {
      name: 'dau-realtime',
      mode: 'realtime',
      queue: 'events',
      plugin: DAUMetricPlugin,
      method: 'processDauRealtime',
      enabled: true,
    },
    //{
    //  name: 'retention-batch',
    //  mode: 'batch',
    //  schedule: '0 0 * * *', // cada día
    //  plugin: '',//RetentionMetricPlugin,
    //  method: 'refreshRetentionBatch',
    //  enabled: true,
    //},
    //{
    //  name: 'retention-realtime',
    //  mode: 'realtime',
    //  queue: 'events',
    //  plugin: '',//RetentionMetricPlugin,
    //  method: 'processRetentionRealtime',
    //  enabled: false,
    //},
  ];
  