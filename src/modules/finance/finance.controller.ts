import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateFundDto } from './dto/create-fund.dto';
import { CreateMoneyVoucherDto } from './dto/create-money-voucher.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @Get('funds')
  @ApiOperation({ summary: 'Get all funds' })
  findFunds(@Query('page') page?: string, @Query('size') size?: string) {
    return this.financeService.findFunds(page, size);
  }

  @Post('funds')
  @ApiOperation({ summary: 'Create fund' })
  createFund(@Body() dto: CreateFundDto) {
    return this.financeService.createFund(dto);
  }

  @Get('money-vouchers')
  @ApiOperation({ summary: 'Get all money vouchers' })
  findMoneyVouchers(
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findMoneyVouchers(page, size);
  }

  @Post('receipts')
  @ApiOperation({ summary: 'Create receipt voucher' })
  createReceipt(@Body() dto: Omit<CreateMoneyVoucherDto, 'type'>) {
    return this.financeService.createReceipt(dto);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Create payment voucher' })
  createPayment(@Body() dto: Omit<CreateMoneyVoucherDto, 'type'>) {
    return this.financeService.createPayment(dto);
  }

  @Get('receipts/received')
  @ApiOperation({ summary: 'Get all received receipts (PT)' })
  findReceiptsReceived(
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findReceiptsReceived(page, size);
  }

  @Get('receipts/paid')
  @ApiOperation({ summary: 'Get all paid receipts (PC)' })
  findReceiptsPaid(
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findReceiptsPaid(page, size);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Get all fund transfers (CQ)' })
  findTransfers(@Query('page') page?: string, @Query('size') size?: string) {
    return this.financeService.findTransfers(page, size);
  }

  @Get('details')
  @ApiOperation({ summary: 'Get all fund details' })
  findDetails(@Query('page') page?: string, @Query('size') size?: string) {
    return this.financeService.findDetails(page, size);
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Create fund transfer (CQ)' })
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.financeService.createTransfer(dto);
  }
}
