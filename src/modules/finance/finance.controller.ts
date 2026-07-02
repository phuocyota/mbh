import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'branchId', required: false })
  findFunds(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findFunds(page, size, branchId);
  }

  @Post('funds')
  @ApiOperation({ summary: 'Create fund' })
  createFund(@Body() dto: CreateFundDto) {
    return this.financeService.createFund(dto);
  }

  @Get('money-vouchers')
  @ApiOperation({ summary: 'Get all money vouchers' })
  @ApiQuery({ name: 'branchId', required: false })
  findMoneyVouchers(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findMoneyVouchers(page, size, branchId);
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
  @ApiQuery({ name: 'branchId', required: false })
  findReceiptsReceived(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findReceiptsReceived(page, size, branchId);
  }

  @Get('receipts/paid')
  @ApiOperation({ summary: 'Get all paid receipts (PC)' })
  @ApiQuery({ name: 'branchId', required: false })
  findReceiptsPaid(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findReceiptsPaid(page, size, branchId);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Get all fund transfers (CQ)' })
  @ApiQuery({ name: 'branchId', required: false })
  findTransfers(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findTransfers(page, size, branchId);
  }

  @Get('details')
  @ApiOperation({ summary: 'Get all fund details' })
  @ApiQuery({ name: 'branchId', required: false })
  findDetails(
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findDetails(page, size, branchId);
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Create fund transfer (CQ)' })
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.financeService.createTransfer(dto);
  }
}
