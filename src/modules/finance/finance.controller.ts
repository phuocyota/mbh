import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateFundDto } from './dto/create-fund.dto';
import { CreateMoneyVoucherDto } from './dto/create-money-voucher.dto';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @Get('funds')
  @ApiOperation({ summary: 'Get all funds' })
  findFunds() {
    return this.financeService.findFunds();
  }

  @Post('funds')
  @ApiOperation({ summary: 'Create fund' })
  createFund(@Body() dto: CreateFundDto) {
    return this.financeService.createFund(dto);
  }

  @Get('money-vouchers')
  @ApiOperation({ summary: 'Get all money vouchers' })
  findMoneyVouchers() {
    return this.financeService.findMoneyVouchers();
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
}
