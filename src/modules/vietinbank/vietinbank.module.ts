import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../../entities/customer.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { VietinBankTopupRequest } from '../../entities/vietinbank-topup-request.entity';
import { VietinBankBankTransaction } from '../../entities/vietinbank-bank-transaction.entity';
import { Branch } from '../../entities/branch.entity';
import { VietinBankAccount } from '../../entities/vietinbank-account.entity';
import { VietinBankIntegrationConfig } from '../../entities/vietinbank-integration-config.entity';
import { VietinBankSecret } from '../../entities/vietinbank-secret.entity';
import { FinanceModule } from '../finance/finance.module';
import { SocketModule } from '../socket/socket.module';
import { VietinBankController } from './vietinbank.controller';
import { VietinBankGatewayService } from './vietinbank-gateway.service';
import { VietinBankService } from './vietinbank.service';
import { VietinBankConfigController } from './vietinbank-config.controller';
import { VietinBankConfigService } from './vietinbank-config.service';
import { VietinBankSecretService } from './vietinbank-secret.service';
import { RolesGuard } from '../../common/guard/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VietinBankTopupRequest,
      VietinBankBankTransaction,
      Customer,
      Wallet,
      WalletTransaction,
      Branch,
      VietinBankAccount,
      VietinBankIntegrationConfig,
      VietinBankSecret,
    ]),
    FinanceModule,
    SocketModule,
  ],
  controllers: [VietinBankController, VietinBankConfigController],
  providers: [
    VietinBankService,
    VietinBankGatewayService,
    VietinBankConfigService,
    VietinBankSecretService,
    RolesGuard,
  ],
  exports: [VietinBankService, VietinBankConfigService],
})
export class VietinBankModule {}
