import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateFundDto } from './dto/create-fund.dto';
import { CreateMoneyVoucherDto } from './dto/create-money-voucher.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @Get('funds')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all funds' })
  @ApiQuery({ name: 'branchId', required: false })
  findFunds(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findFunds(
      page,
      size,
      req.user?.branchId || branchId,
    );
  }

  @Post('funds')
  @ApiOperation({ summary: 'Create fund' })
  createFund(@Body() dto: CreateFundDto) {
    return this.financeService.createFund(dto);
  }

  @Get('money-vouchers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all money vouchers' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'voucherType', required: false })
  @ApiQuery({ name: 'search', required: false })
  findMoneyVouchers(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('voucherType') voucherType?: string,
    @Query('search') search?: string,
  ) {
    return this.financeService.findMoneyVouchers(
      page,
      size,
      req.user?.branchId || branchId,
      { from, to, voucherType, search },
    );
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get income/expense summary by branch' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'voucherType',
    required: false,
    enum: ['RECEIVED', 'PAID', 'TRANSFER', 'PT', 'PC', 'CQ'],
  })
  summary(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('voucherType') voucherType?: string,
    @Query('search') search?: string,
  ) {
    return this.financeService.summary(req.user?.branchId, {
      from,
      to,
      voucherType,
      search,
    });
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all received receipts (PT)' })
  @ApiQuery({ name: 'branchId', required: false })
  findReceiptsReceived(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findReceiptsReceived(
      page,
      size,
      req.user?.branchId || branchId,
    );
  }

  @Get('receipts/paid')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all paid receipts (PC)' })
  @ApiQuery({ name: 'branchId', required: false })
  findReceiptsPaid(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findReceiptsPaid(
      page,
      size,
      req.user?.branchId || branchId,
    );
  }

  @Get('transfers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all fund transfers (CQ)' })
  @ApiQuery({ name: 'branchId', required: false })
  findTransfers(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.financeService.findTransfers(
      page,
      size,
      req.user?.branchId || branchId,
    );
  }

  @Get('details')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all fund details' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({
    name: 'voucherType',
    required: false,
    enum: ['RECEIVED', 'PAID', 'TRANSFER', 'PT', 'PC', 'CQ'],
  })
  @ApiQuery({ name: 'search', required: false })
  findDetails(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('voucherType') voucherType?: string,
    @Query('search') search?: string,
  ) {
    return this.financeService.findDetails(
      page,
      size,
      req.user?.branchId,
      {
        from,
        to,
        voucherType,
        search,
      },
    );
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Create fund transfer (CQ)' })
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.financeService.createTransfer(dto);
  }
}
