import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';
import { StockVoucherService } from './stock-voucher.service';

@ApiTags('Stock Vouchers')
@ApiBearerAuth()
@Controller('stock-vouchers')
export class StockVoucherController {
  constructor(private stockVoucherService: StockVoucherService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock import/export vouchers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  findAll(@Query('page') page?: string, @Query('size') size?: string) {
    return this.stockVoucherService.findAll(page, size);
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
