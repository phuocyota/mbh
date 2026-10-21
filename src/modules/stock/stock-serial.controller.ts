import {
  Body,
  Post,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { RegisterLotSerialsDto } from './dto/register-lot-serials.dto';
import { StockSerialService } from './stock-serial.service';

@ApiTags('Warehouse serials')
@ApiBearerAuth()
@Controller('warehouse/serials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
export class StockSerialController {
  constructor(private readonly serials: StockSerialService) {}
  @Get() list(@Req() req: any, @Query() q: any) {
    return this.serials.list(resolveStockBranch(req.user, q.branchId), q);
  }
  @Get('lots/:lotId/registration')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  registration(
    @Req() req: any,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.serials.registration(resolveStockBranch(req.user, branchId), lotId);
  }
  @Post('lots/:lotId/registration')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  register(
    @Req() req: any,
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Body() dto: RegisterLotSerialsDto,
    @Query('branchId') branchId?: string,
  ) {
    return this.serials.register(resolveStockBranch(req.user, branchId), lotId, dto, req.user.userId);
  }
  @Get(':detailId/:position') detail(
    @Req() req: any,
    @Param('detailId', ParseUUIDPipe) detailId: string,
    @Param('position', ParseIntPipe) position: number,
    @Query('branchId') branchId?: string,
  ) {
    return this.serials.detail(
      resolveStockBranch(req.user, branchId),
      detailId,
      position,
    );
  }
}
