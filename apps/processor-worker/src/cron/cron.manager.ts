// cron/cron.manager.ts
import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
export class CronManager {
  private readonly logger = new Logger(CronManager.name);

  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  /**
   * Registra un nuevo job cron de manera dinámica
   */
  registerJob(
    jobName: string,
    cronPattern: string,
    callback: () => Promise<void> | void
  ): void {
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.logger.warn(`Job "${jobName}" ya existe, será reemplazado.`);
      this.removeJob(jobName);
    }

    const job = new CronJob(cronPattern, async () => {
      this.logger.log(`Ejecutando job: ${jobName}`);
      try {
        await callback();
        this.logger.log(`Job "${jobName}" completado exitosamente`);
      } catch (err) {
        this.logger.error(`Error en job ${jobName}:`, err);
      }
    });

    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
    this.logger.log(`Job "${jobName}" registrado con cron "${cronPattern}"`);
  }

  /**
   * Elimina un job cron
   */
  removeJob(jobName: string): void {
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
      this.logger.log(`Job "${jobName}" eliminado`);
    } else {
      this.logger.warn(`Job "${jobName}" no existe`);
    }
  }

  /**
   * Lista los nombres de todos los jobs cron activos
   */
  listJobs(): string[] {
    return this.schedulerRegistry.getCronJobs()
      ? Array.from(this.schedulerRegistry.getCronJobs().keys())
      : [];
  }

  /**
   * Reinicia un job cron
   */
  restartJob(jobName: string): void {
    const job = this.schedulerRegistry.getCronJob(jobName);
    if (job) {
      job.stop();
      job.start();
      this.logger.log(`Job "${jobName}" reiniciado`);
    } else {
      this.logger.warn(`Job "${jobName}" no encontrado para reiniciar`);
    }
  }
}
