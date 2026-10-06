import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { VietinBankController } from './vietinbank.controller';
import { VietinBankService } from './vietinbank.service';

describe('VietinBankController callback contract', () => {
  let app: INestApplication;
  const service = {
    processNotify: jest.fn().mockResolvedValue({
      transId: 'VTB-TRANS-001',
      providerId: '9480',
      errorCode: '00',
      errorDesc: 'Thanh cong',
      signature: 'SIGNED_RESPONSE',
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VietinBankController],
      providers: [{ provide: VietinBankService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the exact bank schema without the application response wrapper', async () => {
    const callback = {
      msgId: 'MSG001',
      providerId: '9480',
      transId: 'VTB-TRANS-001',
      transTime: '20260922153000',
      custCode: 'VTBABCDEF123456',
      recvAcctId: '999999999',
      amount: '35000',
      bankTransId: 'BANK-001',
      remark: 'NAPTIEN VTBABCDEF123456',
      currencyCode: 'VND',
      signature: 'MOCK_SIGNATURE',
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/vietinbank/notify-bill')
      .send(callback)
      .expect(200);

    expect(service.processNotify).toHaveBeenCalledWith(callback);
    expect(response.body).toEqual({
      transId: 'VTB-TRANS-001',
      providerId: '9480',
      errorCode: '00',
      errorDesc: 'Thanh cong',
      signature: 'SIGNED_RESPONSE',
    });
    expect(response.body.success).toBeUndefined();
  });
});
