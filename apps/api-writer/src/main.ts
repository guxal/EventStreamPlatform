import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // --- SWAGGER CONFIG ---
  const config = new DocumentBuilder()
    .setTitle('EventStream Platform API Writer')
    .setDescription('Write-side API for EventStream events and AI Marketing Copilot project/import/File Hub operations.')
    .setVersion('1.0')
    .addTag('events', 'EventStream core event ingestion')
    .addTag('projects', 'AI Marketing Copilot project management')
    .addTag('imports', 'Legacy marketing import endpoints')
    .addTag('file-hub', 'Bronze Layer File Hub: raw CSV upload, profiling, classification, manual tagging, and queue trigger')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  // -----------------------

  const port = process.env.PORT || 3001;
  app.enableCors();
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `📚 Swagger docs available at: http://localhost:${port}/${globalPrefix}/docs`
  );
}

bootstrap();
