import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserType } from '../../common/enum/user-type.enum';
import { resolveStockBranch } from '../stock/stock-scope';
import { TraceLookupService } from './trace-lookup.service';

@ApiTags('Production traceability')
@ApiBearerAuth()
@Controller('production-trace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
export class TraceLookupController {
  constructor(private readonly lookupService: TraceLookupService) {}
  @Get('lookup')
  @ApiOperation({
    summary: 'Truy xuất mã chính xác hoặc tìm theo số lô, serial, mã và tên hàng',
  })
  @ApiQuery({ name: 'id', type: String, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  lookup(@Req() req: any, @Query() q: any) {
    if (q.search !== undefined)
      return this.lookupService.search(
        resolveStockBranch(req.user, q.branchId), q.search, q.page,
      );
    return this.lookupService.lookup(
      resolveStockBranch(req.user, q.branchId),
      q.id,
    );
  }
}
