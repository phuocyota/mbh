import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserType } from '../../common/enum/user-type.enum';
import { resolveStockBranch } from './stock-scope';
import { WarehouseService } from './warehouse.service';

@ApiTags('Warehouse management')
@ApiBearerAuth()
@Controller('warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}
  @Get('overview') overview(@Req() req: any, @Query() q: any) {
    return this.warehouse.overview(resolveStockBranch(req.user, q.branchId), q);
  }
  @Get('stocks') stocks(@Req() req: any, @Query('branchId') branchId?: string) {
    return this.warehouse.stocks(resolveStockBranch(req.user, branchId));
  }
  @Get('inventory') inventory(@Req() req: any, @Query() q: any) {
    return this.warehouse.inventory(
      resolveStockBranch(req.user, q.branchId),
      q,
    );
  }
  @Get('inventory/:id') detail(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: any,
  ) {
    return this.warehouse.detail(
      resolveStockBranch(req.user, q.branchId),
      id,
      q,
    );
  }
}
