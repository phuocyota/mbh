import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WalletTransactionService } from './wallet-transaction.service';
import { CreateWalletTransactionDto } from './dto/create-wallet-transaction.dto';
import { WalletTransactionDto } from './dto/wallet-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Wallet Transactions')
@ApiBearerAuth()
@Controller('wallet-transactions')
export class WalletTransactionController {
  constructor(private walletTransactionService: WalletTransactionService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all wallet transactions' })
  @ApiResponse({
    status: 200,
    description: 'List of wallet transactions',
    type: [WalletTransactionDto],
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'size', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type', required: false })
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.walletTransactionService.findAll(
      page,
      size,
      search,
      type,
      req.user?.branchId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get wallet transaction by ID' })
  @ApiParam({ name: 'id', description: 'Wallet Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Wallet transaction details',
    type: WalletTransactionDto,
  })
  @ApiResponse({ status: 404, description: 'Wallet transaction not found' })
  async findOne(@Param('id') id: string) {
    return this.walletTransactionService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new wallet transaction' })
  @ApiResponse({
    status: 201,
    description: 'Wallet transaction created',
    type: WalletTransactionDto,
  })
  async create(@Body() createWalletTransactionDto: CreateWalletTransactionDto) {
    return this.walletTransactionService.create(createWalletTransactionDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update wallet transaction' })
  @ApiParam({ name: 'id', description: 'Wallet Transaction ID' })
  @ApiResponse({
    status: 200,
    description: 'Wallet transaction updated',
    type: WalletTransactionDto,
  })
  @ApiResponse({ status: 404, description: 'Wallet transaction not found' })
  async update(
    @Param('id') id: string,
    @Body() createWalletTransactionDto: CreateWalletTransactionDto,
  ) {
    return this.walletTransactionService.update(
      id,
      createWalletTransactionDto,
      {
        userId: 'system',
      } as any,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete wallet transaction' })
  @ApiParam({ name: 'id', description: 'Wallet Transaction ID' })
  @ApiResponse({ status: 204, description: 'Wallet transaction deleted' })
  @ApiResponse({ status: 404, description: 'Wallet transaction not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.walletTransactionService.delete(id, {
      userId: 'system',
    } as any);
  }
}
