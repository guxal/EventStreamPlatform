import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  // Using definite assignment assertion (!) because client is initialized in onModuleInit()
  private client!: RedisClientType;

  async onModuleInit() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    this.client.on('error', (err) => this.logger.error('Redis Client Error', err));
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis disconnected');
    }
  }

  // Métodos básicos
  async set(key: string, value: string) {
    return this.client.set(key, value);
  }
  async get(key: string) {
    return this.client.get(key);
  }
  async sadd(key: string, member: string) {
    return this.client.sAdd(key, member);
  }
  async expire(key: string, seconds: number) {
    return this.client.expire(key, seconds);
  }
  // ...Agrega más métodos según tu necesidad
}
