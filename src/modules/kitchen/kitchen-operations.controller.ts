import {
  KitchenDocumentDto,
  KitchenBatchUpdateDto,
} from './dto/kitchen-document.dto';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserType } from '../../common/enum/user-type.enum';
import { KitchenOperationsService } from './kitchen-operations.service';

@ApiTags('Kitchen operations')
@ApiBearerAuth()
@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
export class KitchenOperationsController {
  constructor(private operations: KitchenOperationsService) {}
  @Get('dashboard') dashboard(@Req() req: any, @Query() q: any) {
    return this.operations.summary(req.user, q);
  }
  @Get('history') history(@Req() req: any, @Query() q: any) {
    return this.operations.history(req.user, q);
  }
  @Get('reports/meal-flow')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  report(@Req() req: any, @Query() q: any) {
    return this.operations.summary(req.user, q);
  }
  @Put('batches/:id')
  batch(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: KitchenBatchUpdateDto,
  ) {
    return this.operations.transition(req.user, id, dto, 'UPDATE');
  }
  @Get(':resource')
  @ApiOperation({
    summary:
      'Read kitchen menus, manual-plans, finished-imports/exports/inventory, disposals, samples or shift-closings',
  })
  list(@Req() req: any, @Param('resource') kind: string, @Query() q: any) {
    return this.operations.list(req.user, kind, q);
  }
  @Get(':resource/:id')
  one(
    @Req() req: any,
    @Param('resource') kind: string,
    @Param('id') id: string,
  ) {
    return this.operations.get(req.user, kind, id);
  }
  @Post(':resource')
  create(
    @Req() req: any,
    @Param('resource') kind: string,
    @Body() dto: KitchenDocumentDto,
  ) {
    return this.operations.write(req.user, kind, dto);
  }
  @Put(':resource/:id')
  update(
    @Req() req: any,
    @Param('resource') kind: string,
    @Param('id') id: string,
    @Body() dto: KitchenDocumentDto,
  ) {
    return this.operations.write(req.user, kind, dto, id);
  }
  @Post(':resource/:id/:action')
  action(
    @Req() req: any,
    @Param('resource') kind: string,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() dto: KitchenDocumentDto,
  ) {
    return this.operations.action(
      req.user,
      kind,
      id,
      kind === 'disposals' && action === 'confirm'
        ? 'confirm-disposal'
        : action,
      dto,
    );
  }
}
