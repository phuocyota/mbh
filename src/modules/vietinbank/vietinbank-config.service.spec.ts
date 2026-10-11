import { VietinBankConfigService } from './vietinbank-config.service';

describe('VietinBankConfigService runtime resolution', () => {
  const makeService = () => {
    const configs: Record<string, any> = {
      'branch-a': {
        id: 'config-a',
        branchId: 'branch-a',
        environment: 'UAT',
        status: 'ACTIVE',
        clientSecretRef: 'a/client',
        partnerPrivateKeyRef: 'a/private',
      },
      'branch-b': {
        id: 'config-b',
        branchId: 'branch-b',
        environment: 'UAT',
        status: 'ACTIVE',
        clientSecretRef: 'b/client',
        partnerPrivateKeyRef: 'b/private',
      },
    };
    const accounts: Record<string, any> = {
      'config-a': {
        id: 'account-a',
        integrationConfigId: 'config-a',
        accountNumber: '111',
      },
      'config-b': {
        id: 'account-b',
        integrationConfigId: 'config-b',
        accountNumber: '222',
      },
    };
    const configRepository = {
      findOne: jest.fn(async ({ where }) => configs[where.branchId] || null),
    };
    const accountRepository = {
      findOne: jest.fn(
        async ({ where }) => accounts[where.integrationConfigId] || null,
      ),
    };
    const secretService = {
      get: jest.fn(async (ref: string) => `secret:${ref}`),
    };
    const service = new VietinBankConfigService(
      configRepository as any,
      accountRepository as any,
      {} as any,
      {
        get: jest.fn((key) =>
          key === 'VIETINBANK_ENVIRONMENT' ? 'UAT' : 'false',
        ),
      } as any,
      secretService as any,
    );
    return { service, configs, secretService };
  };

  it('keeps simultaneous branch config and secrets isolated', async () => {
    const { service } = makeService();

    const [branchA, branchB] = await Promise.all([
      service.resolveForBranch('branch-a'),
      service.resolveForBranch('branch-b'),
    ]);

    expect(branchA.config.id).toBe('config-a');
    expect(branchA.account.accountNumber).toBe('111');
    expect(branchA.clientSecret).toBe('secret:a/client');
    expect(branchB.config.id).toBe('config-b');
    expect(branchB.account.accountNumber).toBe('222');
    expect(branchB.clientSecret).toBe('secret:b/client');
  });

  it('rejects an inactive config before resolving an account or secret', async () => {
    const { service, configs, secretService } = makeService();
    configs['branch-a'].status = 'INACTIVE';

    await expect(service.resolveForBranch('branch-a')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VIETINBANK_CONFIG_INACTIVE' }),
    });
    expect(secretService.get).not.toHaveBeenCalled();
  });
});
