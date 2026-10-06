import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VietinBankSecret } from '../../entities/vietinbank-secret.entity';
import { VietinBankException } from './vietinbank.error';
import {
  decryptVietinBankSecret,
  parseVietinBankMasterKey,
} from './vietinbank-secret.crypto';

@Injectable()
export class VietinBankSecretService {
  constructor(
    @InjectRepository(VietinBankSecret)
    private readonly secretRepository: Repository<VietinBankSecret>,
    private readonly configService: ConfigService,
  ) {}

  async get(ref: string): Promise<string> {
    const secret = await this.secretRepository.findOne({ where: { ref } });
    if (!secret) {
      throw new VietinBankException(
        'VIETINBANK_SECRET_NOT_FOUND',
        'VietinBank secret not found',
      );
    }

    try {
      return decryptVietinBankSecret(
        secret,
        parseVietinBankMasterKey(
          this.configService.get<string>('VIETINBANK_SECRET_MASTER_KEY'),
        ),
      );
    } catch {
      throw new VietinBankException(
        'VIETINBANK_SECRET_NOT_FOUND',
        'VietinBank secret cannot be decrypted',
      );
    }
  }
}
