import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVietinBankConfigDto } from './vietinbank-config.dto';

describe('VietinBank config DTO', () => {
  const validConfig = {
    branchId: '11111111-1111-4111-8111-111111111111',
    environment: 'UAT',
    providerId: '9480',
    merchantId: '8CAP',
    clientId: 'client-id',
    clientSecretRef: 'vietinbank/branch/uat/client-secret',
    partnerPrivateKeyRef: 'vietinbank/branch/uat/private-key',
    bankPublicKey: 'public-key',
    apiBaseUrl: 'https://api-uat.vietinbank.vn',
  };

  it.each(['clientSecret', 'privateKey'])(
    'rejects plaintext field %s',
    async (field) => {
      const dto = plainToInstance(CreateVietinBankConfigDto, {
        ...validConfig,
        [field]: 'must-not-be-accepted',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === field)).toBe(true);
    },
  );
});
