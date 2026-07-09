import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';
import { StockVoucherService } from './stock-voucher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Stock Vouchers')
@ApiBearerAuth()
@Controller('stock-vouchers')
export class StockVoucherController {
  constructor(private stockVoucherService: StockVoucherService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all stock import/export vouchers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.stockVoucherService.findAll(
      page,
      size,
      req.user?.branchId || branchId,
    );
  }

  @Post('imports')
  @ApiOperation({ summary: 'Create stock import voucher and payment voucher' })
  createImport(@Body() dto: CreateStockVoucherDto) {
    if (dto.type) {
      return this.createByType(dto);
    }

    return this.stockVoucherService.createImportVoucher(dto);
  }

  @Post('exports')
  @ApiOperation({ summary: 'Create stock export voucher and receipt voucher' })
  createExport(@Body() dto: CreateStockVoucherDto) {
    if (dto.type) {
      return this.createByType(dto);
    }

    return this.stockVoucherService.createExportVoucher(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create stock voucher by type' })
  create(@Body() dto: CreateStockVoucherDto) {
    return this.createByType(dto);
  }

  private createByType(dto: CreateStockVoucherDto) {
    const type = dto.type?.toUpperCase();

    if (type === 'IMPORT') {
      return this.stockVoucherService.createImportVoucher(dto);
    }

    if (type === 'EXPORT') {
      return this.stockVoucherService.createExportVoucher(dto);
    }

    if (type === 'TRANSFER') {
      return this.stockVoucherService.createVoucher(dto);
    }

    throw new BadRequestException(
      'type must be one of IMPORT, EXPORT, TRANSFER',
    );
  }
}
