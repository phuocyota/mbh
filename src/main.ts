import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = 3002;

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'https://fe.kidocanteen.kidoedu.vn',
      'http://localhost:5173',
    ],
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

  // Global response interceptor (success, message, data format)
  app.useGlobalInterceptors(new ResponseInterceptor());

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

  await app.listen(port, '0.0.0.0');
  console.log(`✅ Application running on port ${port}`);
  console.log(
    `📚 Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
