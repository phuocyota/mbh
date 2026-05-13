import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { WalletDto } from './dto/wallet.dto';
import { TopupWalletDto, WalletBalanceDto } from './dto/topup-wallet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get all wallets' })
  @ApiResponse({
    status: 200,
    description: 'List of wallets',
    type: [WalletDto],
  })
  async findAll() {
    return this.walletService.findAll();
  }

  @Post('topup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nạp tiền vào ví của customer',
    description:
      'Tự động tạo ví nếu chưa có. Ghi nhận giao dịch type=TOPUP. Cần JWT.',
  })
  @ApiResponse({ status: 200, description: 'Nạp tiền thành công' })
  async topup(@Body() dto: TopupWalletDto, @Req() req: any) {
    const userId = req.user?.userId || 'system';
    return this.walletService.topup(
      dto.customerId,
      dto.amount,
      userId,
      dto.note,
    );
  }

  @Get('customer/:customerId/balance')
  @ApiOperation({ summary: 'Lấy số dư ví của customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, type: WalletBalanceDto })
  async getBalance(@Param('customerId') customerId: string) {
    return this.walletService.getBalanceByCustomer(customerId);
  }

  @Get('customer/:customerId/transactions')
  @ApiOperation({ summary: 'Lịch sử giao dịch ví của customer' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'size', required: false, type: Number, example: 20 })
  async getTransactions(
    @Param('customerId') customerId: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.walletService.getTransactionsByCustomer(
      customerId,
      page,
      size,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get wallet by ID' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({
    status: 200,
    description: 'Wallet details',
    type: WalletDto,
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async findOne(@Param('id') id: string) {
    return this.walletService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new wallet' })
  @ApiResponse({
    status: 201,
    description: 'Wallet created',
    type: WalletDto,
  })
  async create(@Body() createWalletDto: CreateWalletDto) {
    return this.walletService.create(createWalletDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update wallet' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({
    status: 200,
    description: 'Wallet updated',
    type: WalletDto,
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async update(
    @Param('id') id: string,
    @Body() createWalletDto: CreateWalletDto,
  ) {
    return this.walletService.update(id, createWalletDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete wallet' })
  @ApiParam({ name: 'id', description: 'Wallet ID' })
  @ApiResponse({ status: 204, description: 'Wallet deleted' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.walletService.delete(id, { userId: 'system' } as any);
  }
}
