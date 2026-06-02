import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ResponseLoggerInterceptor } from './common/interceptors/response-logger.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/request-logger-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = 3002;

  // Enable CORS for frontend
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://fe.kidocanteen.kidoedu.vn',
        'https://fe.parent.kidocanteen.kidoedu.vn',
        'https://fe.admin.kidocanteen.kidoedu.vn',
        'http://localhost:5173',
        'https://localhost:5173',
        'http://localhost:5171',
      ];
      // Allow private network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      const privateIpRegex = /^(http:\/\/)(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)[^:]+:\d+$/;
      
      if (!origin || allowedOrigins.includes(origin) || privateIpRegex.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      }
    },
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

  // Global request/response logs
  const requestLogger = new RequestLoggerMiddleware();
  app.use(requestLogger.use.bind(requestLogger));

  // Global response interceptor (success, message, data format)
  app.useGlobalInterceptors(
    new ResponseLoggerInterceptor(),
    new ResponseInterceptor(),
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
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, '0.0.0.0');
  console.log(`✅ Application running on port ${port}`);
  console.log(
    `📚 Swagger documentation available at http://localhost:${port}/docs`,
  );
}
void bootstrap();
