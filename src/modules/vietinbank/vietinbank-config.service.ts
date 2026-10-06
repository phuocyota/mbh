import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { VietinBankAccount } from '../../entities/vietinbank-account.entity';
import {
  VietinBankEnvironment,
  VietinBankIntegrationConfig,
} from '../../entities/vietinbank-integration-config.entity';
import {
  CreateVietinBankAccountDto,
  CreateVietinBankConfigDto,
  UpdateVietinBankAccountDto,
  UpdateVietinBankConfigDto,
  UpdateVietinBankSecretsDto,
  UpdateVietinBankStatusDto,
} from './dto/vietinbank-config.dto';
import { VietinBankException } from './vietinbank.error';
import { VietinBankSecretService } from './vietinbank-secret.service';

export interface VietinBankRuntimeContext {
  config: VietinBankIntegrationConfig;
  account: VietinBankAccount;
  clientSecret: string | null;
  privateKey: string | null;
}

@Injectable()
export class VietinBankConfigService {
  constructor(
    @InjectRepository(VietinBankIntegrationConfig)
    private readonly configRepository: Repository<VietinBankIntegrationConfig>,
    @InjectRepository(VietinBankAccount)
    private readonly accountRepository: Repository<VietinBankAccount>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly appConfig: ConfigService,
    private readonly secretService: VietinBankSecretService,
  ) {}

  async create(dto: CreateVietinBankConfigDto, userId: string) {
    await this.assertBranch(dto.branchId);
    const duplicate = await this.configRepository.findOne({
      where: { branchId: dto.branchId, environment: dto.environment },
    });
    if (duplicate) {
      throw new ConflictException(
        'VietinBank config already exists for this branch and environment',
      );
    }
    return this.configRepository.save(
      this.configRepository.create({
        ...dto,
        productId: dto.productId || null,
        gatewayId: dto.gatewayId || null,
        username: dto.username || null,
        partnerPublicKey: dto.partnerPublicKey || null,
        status: dto.status || 'ACTIVE',
        createdBy: userId,
      }),
    );
  }

  async findOne(id: string) {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) throw new NotFoundException('VietinBank config not found');
    return config;
  }

  findAll(branchId?: string, environment?: VietinBankEnvironment) {
    return this.configRepository.find({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(environment ? { environment } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateVietinBankConfigDto, userId: string) {
    const config = await this.findOne(id);
    Object.assign(config, dto, { updatedBy: userId });
    return this.configRepository.save(config);
  }

  async updateSecrets(
    id: string,
    dto: UpdateVietinBankSecretsDto,
    userId: string,
  ) {
    const config = await this.findOne(id);
    if (!dto.clientSecretRef && !dto.partnerPrivateKeyRef) {
      throw new BadRequestException(
        'At least one secret reference is required',
      );
    }
    if (dto.clientSecretRef) config.clientSecretRef = dto.clientSecretRef;
    if (dto.partnerPrivateKeyRef) {
      config.partnerPrivateKeyRef = dto.partnerPrivateKeyRef;
    }
    config.updatedBy = userId;
    return this.configRepository.save(config);
  }

  async updateStatus(
    id: string,
    dto: UpdateVietinBankStatusDto,
    userId: string,
  ) {
    const config = await this.findOne(id);
    config.status = dto.status;
    config.updatedBy = userId;
    return this.configRepository.save(config);
  }

  disable(id: string, userId: string) {
    return this.updateStatus(id, { status: 'INACTIVE' }, userId);
  }

  async addAccount(
    configId: string,
    dto: CreateVietinBankAccountDto,
    userId: string,
  ) {
    const config = await this.findOne(configId);
    await this.assertAccountIdentityAvailable(
      dto.accountNumber,
      config.environment,
    );
    return this.accountRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(VietinBankAccount);
      if (dto.isDefault) {
        await repository.update(
          { integrationConfigId: configId, isDefault: true },
          { isDefault: false, updatedBy: userId },
        );
      }
      return repository.save(
        repository.create({
          ...dto,
          integrationConfigId: configId,
          branchId: config.branchId,
          accountName: dto.accountName || null,
          accountType: dto.accountType || null,
          priority: dto.priority ?? 0,
          isDefault: dto.isDefault ?? false,
          status: 'ACTIVE',
          createdBy: userId,
        }),
      );
    });
  }

  async listAccounts(configId: string) {
    await this.findOne(configId);
    return this.accountRepository.find({
      where: { integrationConfigId: configId },
      order: { isDefault: 'DESC', priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async updateAccount(
    id: string,
    dto: UpdateVietinBankAccountDto,
    userId: string,
  ) {
    const account = await this.accountRepository.findOne({
      where: { id },
      relations: { integrationConfig: true },
    });
    if (!account) throw new NotFoundException('VietinBank account not found');
    if (dto.accountNumber && dto.accountNumber !== account.accountNumber) {
      await this.assertAccountIdentityAvailable(
        dto.accountNumber,
        account.integrationConfig.environment,
        account.id,
      );
    }
    return this.accountRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(VietinBankAccount);
      if (dto.isDefault) {
        await repository.update(
          { integrationConfigId: account.integrationConfigId, isDefault: true },
          { isDefault: false, updatedBy: userId },
        );
      }
      Object.assign(account, dto, { updatedBy: userId });
      return repository.save(account);
    });
  }

  async resolveForBranch(branchId: string): Promise<VietinBankRuntimeContext> {
    if (!branchId) {
      throw new VietinBankException(
        'CANTEEN_FORBIDDEN',
        'User does not have access to a canteen',
        HttpStatus.FORBIDDEN,
      );
    }
    const environment = this.currentEnvironment();
    const config = await this.configRepository.findOne({
      where: { branchId, environment },
    });
    if (!config) {
      throw new VietinBankException(
        'VIETINBANK_CONFIG_NOT_FOUND',
        'VietinBank configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (config.status !== 'ACTIVE') {
      throw new VietinBankException(
        'VIETINBANK_CONFIG_INACTIVE',
        'VietinBank integration is inactive',
      );
    }
    return this.buildRuntimeContext(config, true);
  }

  async resolveForCallback(
    configId: string | null,
    accountId: string | null,
    providerId: string,
    accountNumber: string,
  ): Promise<VietinBankRuntimeContext> {
    let config: VietinBankIntegrationConfig | null = null;
    let account: VietinBankAccount | null = null;
    if (configId && accountId) {
      config = await this.configRepository.findOne({ where: { id: configId } });
      account = await this.accountRepository.findOne({
        where: { id: accountId, integrationConfigId: configId },
      });
    } else {
      const matches = await this.accountRepository
        .createQueryBuilder('account')
        .innerJoinAndSelect('account.integrationConfig', 'config')
        .where('account.accountNumber = :accountNumber', { accountNumber })
        .andWhere('config.providerId = :providerId', { providerId })
        .andWhere('config.environment = :environment', {
          environment: this.currentEnvironment(),
        })
        .getMany();
      if (matches.length === 1) {
        account = matches[0];
        config = matches[0].integrationConfig;
      }
    }
    if (!config) {
      throw new VietinBankException(
        'VIETINBANK_CONFIG_NOT_FOUND',
        'VietinBank configuration not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!account) {
      throw new VietinBankException(
        'VIETINBANK_ACCOUNT_NOT_FOUND',
        'No VietinBank account found',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.buildRuntimeContext(config, false, account);
  }

  private async buildRuntimeContext(
    config: VietinBankIntegrationConfig,
    requireClientSecret: boolean,
    resolvedAccount?: VietinBankAccount,
  ): Promise<VietinBankRuntimeContext> {
    const account =
      resolvedAccount ||
      (await this.accountRepository.findOne({
        where: {
          integrationConfigId: config.id,
          status: 'ACTIVE',
          isDefault: true,
        },
        order: { priority: 'DESC' },
      }));
    if (!account) {
      throw new VietinBankException(
        'VIETINBANK_ACCOUNT_NOT_FOUND',
        'No active default VietinBank account found',
        HttpStatus.NOT_FOUND,
      );
    }
    const mock = this.isMock();
    return {
      config,
      account,
      clientSecret:
        mock || !requireClientSecret
          ? null
          : await this.secretService.get(config.clientSecretRef),
      privateKey: mock
        ? null
        : await this.secretService.get(config.partnerPrivateKeyRef),
    };
  }

  private currentEnvironment(): VietinBankEnvironment {
    const value = this.appConfig.get<string>('VIETINBANK_ENVIRONMENT');
    if (value !== 'UAT' && value !== 'PROD') {
      throw new Error('VIETINBANK_ENVIRONMENT must be UAT or PROD');
    }
    return value;
  }

  private isMock(): boolean {
    return (
      this.appConfig.get<string>('NODE_ENV') !== 'production' &&
      this.appConfig.get<string>('VIETINBANK_MOCK_ENABLED') === 'true'
    );
  }

  private async assertBranch(branchId: string) {
    if (!(await this.branchRepository.exist({ where: { id: branchId } }))) {
      throw new NotFoundException('Branch not found');
    }
  }

  private async assertAccountIdentityAvailable(
    accountNumber: string,
    environment: VietinBankEnvironment,
    excludedAccountId?: string,
  ) {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .innerJoin('account.integrationConfig', 'config')
      .where('account.accountNumber = :accountNumber', { accountNumber })
      .andWhere('config.environment = :environment', { environment });
    if (excludedAccountId) {
      query.andWhere('account.id <> :excludedAccountId', {
        excludedAccountId,
      });
    }
    const duplicate = await query.getOne();
    if (duplicate) {
      throw new ConflictException(
        'VietinBank account is already assigned in this environment',
      );
    }
  }
}
