/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

//async function bootstrap() {
//  const app = await NestFactory.create(AppModule);
//  const globalPrefix = 'api';
//  app.setGlobalPrefix(globalPrefix);
//  const port = process.env.PORT || 3000;
//  await app.listen(port);
//  Logger.log(
//    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
//  );
//}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  // No es un HTTP server, así que solo necesita levantar el contexto
  // Los cronjobs arrancan automáticamente
  // Puedes dejar logs para monitorear si todo inició bien
  console.log('Processor-worker started');
}

bootstrap();
