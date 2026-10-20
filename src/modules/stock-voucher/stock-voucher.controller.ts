import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { UserType } from '../../common/enum/user-type.enum';
import { resolveStockBranch } from '../stock/stock-scope';
import {
  BadRequestException,
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
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';
import { CreateMaterialImportDto } from './dto/create-material-import.dto';
import { StockVoucherService } from './stock-voucher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { STOCK_VOUCHER_TYPE } from './stock-voucher.constants';

@ApiTags('Stock Vouchers')
@ApiBearerAuth()
@Controller('stock-vouchers')
@UseGuards(JwtAuthGuard)
export class StockVoucherController {
  constructor(private stockVoucherService: StockVoucherService) {}

  @Post('material-imports')
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({
    summary:
      'Nhập nguyên liệu/nhiên liệu theo lô, ghi nguồn NCC và cập nhật tồn kho',
  })
  createMaterialImport(@Req() req: any, @Body() dto: CreateMaterialImportDto) {
    return this.stockVoucherService.createMaterialImport(
      {
        ...dto,
        branchId: resolveStockBranch(req.user, dto.branchId),
      },
      req.user.userId,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.HEAD_CHEF)
  @ApiOperation({ summary: 'Get all stock import/export vouchers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('productType') productType?: string,
    @Query('receiptType') receiptType?: string,
    @Query('salesOnly') salesOnly?: string,
  ) {
    return this.stockVoucherService.findAll(
      page,
      size,
      req.user?.branchId || branchId,
      { productType, receiptType, salesOnly: salesOnly === 'true' },
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post('sales')
  @ApiOperation({ summary: 'Create a sale export and receipt atomically' })
  createSale(@Req() req: any, @Body() dto: CreateStockVoucherDto) {
    return this.stockVoucherService.createSaleVoucher({
      ...dto,
      branchId: resolveStockBranch(req.user, dto.branchId),
      actorId: req.user.userId,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post('imports')
  @ApiOperation({ summary: 'Create stock import voucher and payment voucher' })
  createImport(@Req() req: any, @Body() dto: CreateStockVoucherDto) {
    dto.actorId = req.user.userId;
    dto.branchId = resolveStockBranch(req.user, dto.branchId);
    if (dto.fromBranchId) resolveStockBranch(req.user, dto.fromBranchId);
    if (dto.type) {
      return this.createByType(dto);
    }

    return this.stockVoucherService.createImportVoucher(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post('exports')
  @ApiOperation({ summary: 'Create stock export voucher and receipt voucher' })
  createExport(@Req() req: any, @Body() dto: CreateStockVoucherDto) {
    dto.actorId = req.user.userId;
    dto.branchId = resolveStockBranch(req.user, dto.branchId);
    if (dto.fromBranchId) resolveStockBranch(req.user, dto.fromBranchId);
    if (dto.type) {
      return this.createByType(dto);
    }

    return this.stockVoucherService.createExportVoucher(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create stock voucher by type' })
  create(@Req() req: any, @Body() dto: CreateStockVoucherDto) {
    dto.actorId = req.user.userId;
    dto.branchId = resolveStockBranch(req.user, dto.branchId);
    if (dto.fromBranchId) resolveStockBranch(req.user, dto.fromBranchId);
    return this.createByType(dto);
  }

  private createByType(dto: CreateStockVoucherDto) {
    const type = dto.type?.toUpperCase();

    if (type === STOCK_VOUCHER_TYPE.IMPORT) {
      return this.stockVoucherService.createImportVoucher(dto);
    }

    if (type === STOCK_VOUCHER_TYPE.EXPORT) {
      return this.stockVoucherService.createExportVoucher(dto);
    }

    if (type === STOCK_VOUCHER_TYPE.TRANSFER) {
      return this.stockVoucherService.createVoucher(dto);
    }

    throw new BadRequestException(
      'type must be one of IMPORT, EXPORT, TRANSFER',
    );
  }
}
