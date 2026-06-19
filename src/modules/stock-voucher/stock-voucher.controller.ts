import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';
import { StockVoucherService } from './stock-voucher.service';

@ApiTags('Stock Vouchers')
@ApiBearerAuth()
@Controller('stock-vouchers')
export class StockVoucherController {
  constructor(private stockVoucherService: StockVoucherService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock import/export vouchers' })
  findAll() {
    return this.stockVoucherService.findAll();
  }

  @Post('imports')
  @ApiOperation({ summary: 'Create stock import voucher and payment voucher' })
  createImport(@Body() dto: Omit<CreateStockVoucherDto, 'type'>) {
    return this.stockVoucherService.createImportVoucher(dto);
  }

  @Post('exports')
  @ApiOperation({ summary: 'Create stock export voucher and receipt voucher' })
  createExport(@Body() dto: Omit<CreateStockVoucherDto, 'type'>) {
    return this.stockVoucherService.createExportVoucher(dto);
  }
}
