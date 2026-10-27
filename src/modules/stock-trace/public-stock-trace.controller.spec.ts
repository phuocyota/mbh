import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { ReadOnlyRoleGuard } from '../../common/guard/read-only-role.guard';
import { PublicStockTraceController } from './public-stock-trace.controller';
import { StockTraceController } from './stock-trace.controller';
import { StockTraceService } from './stock-trace.service';

describe('Public stock trace API', () => {
  let app: INestApplication;
  const lotId = '11111111-1111-4111-8111-111111111111';
  const service = {
    getFullTrace: jest.fn(async (query) => ({ lotId: query.lotId })),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicStockTraceController, StockTraceController],
      providers: [
        JwtStrategy,
        { provide: StockTraceService, useValue: service },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: APP_GUARD, useClass: ReadOnlyRoleGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('returns the existing trace contract without an Authorization header', async () => {
    const response = await request(app.getHttpServer())
      .get('/stock-trace/full')
      .query({ lotId })
      .expect(200);
    expect(response.body).toEqual({ lotId });
    expect(service.getFullTrace).toHaveBeenCalledWith(
      expect.objectContaining({ lotId }),
    );
  });
  it.each(['batchId', 'unitId'])(
    'requires lotId instead of %s',
    async (field) => {
      await request(app.getHttpServer())
        .get('/stock-trace/full')
        .query({ [field]: lotId })
        .expect(400);
    },
  );
  it.each(['', '   ', 'x'.repeat(256)])(
    'rejects invalid identities %p',
    async (value) => {
      await request(app.getHttpServer())
        .get('/stock-trace/full')
        .query({ lotId: value })
        .expect(400);
    },
  );
  it('accepts a lot code in lotId without a token and trims whitespace', async () => {
    const code = 'LO-78e74975-7024-49d6-87c1-0b112e3e94ff';
    await request(app.getHttpServer())
      .get('/stock-trace/full')
      .query({ lotId: ` ${code} ` })
      .expect(200);
    expect(service.getFullTrace).toHaveBeenLastCalledWith(
      expect.objectContaining({ lotId: code }),
    );
  });
  it('requires an identity', async () => {
    await request(app.getHttpServer()).get('/stock-trace/full').expect(400);
  });
  it('keeps other trace endpoints authenticated', async () => {
    await request(app.getHttpServer())
      .get(`/stock-trace/lots/${lotId}`)
      .expect(401);
  });
  it('documents the public route without Bearer auth', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(document.paths['/stock-trace/full'].get?.security || []).toEqual([]);
    expect(document.paths['/stock-trace/lots/{lotId}'].get?.security).toEqual(
      expect.arrayContaining([{ bearer: [] }]),
    );
  });
});
