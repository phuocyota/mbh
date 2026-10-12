import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { UserType } from '../../common/enum/user-type.enum';
import { resolveStockBranch } from '../stock/stock-scope';
import {
  Body,
  Controller,
  Get,
  Param,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StockTransferService } from './stock-transfer.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';

@ApiTags('Stock Transfers')
@ApiBearerAuth()
@Controller('stock-transfers')
@UseGuards(JwtAuthGuard)
export class StockTransferController {
  constructor(private readonly stockTransferService: StockTransferService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock transfers' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'fromBranchId', required: false })
  @ApiQuery({ name: 'toBranchId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('fromBranchId') fromBranchId?: string,
    @Query('toBranchId') toBranchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.stockTransferService.findAll({
      status,
      branchId: req.user?.branchId || branchId,
      fromBranchId: req.user?.branchId ? undefined : fromBranchId,
      toBranchId: req.user?.branchId ? undefined : toBranchId,
      page,
      size,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const current = await this.stockTransferService.findOne(id);
    resolveStockBranch(
      req.user,
      req.user.branchId === current.toBranchId
        ? current.toBranchId
        : current.fromBranchId,
    );
    return current;
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create and complete a stock transfer' })
  create(@Req() req: any, @Body() dto: CreateStockTransferDto) {
    dto.actorId = req.user.userId;
    resolveStockBranch(req.user, dto.fromBranchId);
    return this.stockTransferService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a stock transfer' })
  async complete(@Req() req: any, @Param('id') id: string) {
    const current = await this.stockTransferService.findOne(id);
    resolveStockBranch(req.user, current.fromBranchId);
    return this.stockTransferService.complete(id, req.user.userId);
  }
}
