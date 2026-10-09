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
import { StockTakeService } from './stock-take.service';
import { CreateStockTakeDto } from './dto/create-stock-take.dto';

@ApiTags('Stock Takes')
@ApiBearerAuth()
@Controller('stock-takes')
@UseGuards(JwtAuthGuard)
export class StockTakeController {
  constructor(private readonly stockTakeService: StockTakeService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock takes' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.stockTakeService.findAll({
      status,
      branchId: req.user?.branchId || branchId,
      page,
      size,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock take by ID' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const current = await this.stockTakeService.findOne(id);
    resolveStockBranch(req.user, current.branchId);
    return this.stockTakeService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post('drafts')
  @ApiOperation({ summary: 'Create a draft stock take' })
  createDraft(@Req() req: any, @Body() dto: CreateStockTakeDto) {
    dto.actorId = req.user.userId;
    dto.branchId = resolveStockBranch(req.user, dto.branchId);
    return this.stockTakeService.createDraft(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a stock take' })
  async complete(@Req() req: any, @Param('id') id: string) {
    const current = await this.stockTakeService.findOne(id);
    resolveStockBranch(req.user, current.branchId);
    return this.stockTakeService.complete(id, req.user.userId);
  }
}
