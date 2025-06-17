import { MetricsRepository } from '@metrics-platform/core-infrastructure';
import { RedisService } from '@metrics-platform/core-infrastructure';

export async function getDAUFromDB(repo: MetricsRepository, period: string) {
  return repo.findDauByDay(period);
}

export async function getDAUFromRedis(redisService: RedisService, period: string) {
    const key = `dau:${period}`;
    const count = await redisService.scard(key);
    return { period, count };
  }