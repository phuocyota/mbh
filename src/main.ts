import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3002;

  // Enable CORS for frontend (cho phép mọi origin local trong dev)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : null;
  app.enableCors({
    origin: corsOrigins ?? true, // `true` = reflect request origin (an toàn cho dev)
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('MBH POS System API')
    .setDescription('API documentation for Multi-Branch Hospitality POS System')
    .setVersion('1.0.0')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Products', 'Product catalog management')
    .addTag('Orders', 'Order management')
    .addTag('Wallets', 'Wallet topup, balance & transactions')
    .addTag('Customers', 'Customer & card lookup')
    .addTag('Refunds', 'Refund flow with approval')
    .addTag('Reports', 'Revenue & inventory reports')
    .addTag('Seed', 'Data seeding for testing')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  console.log(`✅ Application running on port ${port}`);
  console.log(
    `📚 Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
