import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWarehouseVoucherDto } from './dto/create-warehouse-voucher.dto';
import { WarehouseVoucherService } from './warehouse-voucher.service';

@ApiTags('Warehouse Vouchers')
@ApiBearerAuth()
@Controller('warehouse-vouchers')
export class WarehouseVoucherController {
  constructor(private warehouseVoucherService: WarehouseVoucherService) {}

  @Get()
  @ApiOperation({ summary: 'Get all warehouse vouchers' })
  findAll() {
    return this.warehouseVoucherService.findAll();
  }

  @Post('imports')
  @ApiOperation({ summary: 'Create import voucher and payment voucher' })
  createImport(@Body() dto: Omit<CreateWarehouseVoucherDto, 'type'>) {
    return this.warehouseVoucherService.createImportVoucher(dto);
  }

  @Post('exports')
  @ApiOperation({ summary: 'Create export voucher and receipt voucher' })
  createExport(@Body() dto: Omit<CreateWarehouseVoucherDto, 'type'>) {
    return this.warehouseVoucherService.createExportVoucher(dto);
  }
}
