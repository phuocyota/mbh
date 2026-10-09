import { KitchenBatchUpdateDto } from './dto/kitchen-document.dto';
import { KitchenOperationsService } from './kitchen-operations.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserType } from '../../common/enum/user-type.enum';
import { KitchenService } from './kitchen.service';

const MANAGERS = [UserType.ADMIN, UserType.MANAGER] as const;
const OPERATORS = [UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN] as const;

@ApiTags('Kitchen')
@ApiBearerAuth()
@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KitchenController {
  constructor(
    private readonly kitchen: KitchenService,
    private operations: KitchenOperationsService,
  ) {}

  @Put('staff/:userId/employee-link')
  @Roles(...MANAGERS)
  linkStaff(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body('employeeId') employeeId: string,
  ) {
    return this.kitchen.linkStaff(req.user, userId, employeeId);
  }

  @Get('units')
  @Roles(...OPERATORS)
  units() {
    return this.kitchen.listUnits();
  }

  @Get('stations')
  @Roles(...OPERATORS)
  stations(@Req() req: any, @Query('branchId') branchId?: string) {
    return this.kitchen.listStations(req.user, branchId);
  }

  @Post('stations')
  @Roles(...MANAGERS)
  createStation(@Req() req: any, @Body() dto: any) {
    return this.kitchen.createStation(req.user, dto);
  }

  @Put('stations/:id')
  @Roles(...MANAGERS)
  updateStation(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.kitchen.updateStation(req.user, id, dto);
  }

  @Delete('stations/:id')
  @Roles(...MANAGERS)
  deactivateStation(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.deactivateStation(req.user, id);
  }

  @Put('stations/:id/products/:productId')
  @Roles(...MANAGERS)
  assignProduct(
    @Req() req: any,
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.kitchen.assignProductStation(req.user, id, productId);
  }

  @Get('recipes')
  @Roles(...OPERATORS)
  recipes(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.kitchen.listRecipes(req.user, branchId, productId);
  }

  @Post('recipes')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Create a new immutable recipe version' })
  createRecipe(@Req() req: any, @Body() dto: any) {
    return this.kitchen.createRecipe(req.user, dto);
  }

  @Post('recipes/:id/activate')
  @Roles(...MANAGERS)
  activateRecipe(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.activateRecipe(req.user, id);
  }

  @Delete('recipes/:id')
  @Roles(...MANAGERS)
  deleteRecipe(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.deleteDraftRecipe(req.user, id);
  }

  @Get('service-periods')
  @Roles(...OPERATORS)
  periods(@Req() req: any, @Query('branchId') branchId?: string) {
    return this.kitchen.listPeriods(req.user, branchId);
  }

  @Put('service-periods')
  @Roles(...MANAGERS)
  upsertPeriod(@Req() req: any, @Body() dto: any) {
    return this.kitchen.upsertPeriod(req.user, dto);
  }

  @Get('tickets')
  @Roles(...OPERATORS)
  tickets(@Req() req: any, @Query() query: any) {
    return this.kitchen.listTickets(req.user, query);
  }

  @Get('tickets/:id')
  @Roles(...OPERATORS)
  ticket(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.getTicket(req.user, id);
  }

  @Post('tickets/:id/start')
  @Roles(...OPERATORS)
  startTicket(
    @Req() req: any,
    @Param('id') id: string,
    @Body('expectedVersion') expectedVersion: number,
  ) {
    return this.kitchen.transitionTicket(
      req.user,
      id,
      Number(expectedVersion),
      'PREPARING',
    );
  }

  @Post('tickets/:id/ready')
  @Roles(...OPERATORS)
  readyTicket(
    @Req() req: any,
    @Param('id') id: string,
    @Body('expectedVersion') expectedVersion: number,
  ) {
    return this.kitchen.transitionTicket(
      req.user,
      id,
      Number(expectedVersion),
      'READY',
    );
  }

  @Get('meal-plans')
  @Roles(...OPERATORS)
  mealPlans(@Req() req: any, @Query() query: any) {
    return this.kitchen.getMealPlans(req.user, query);
  }

  @Post('meal-plans')
  @Roles(...MANAGERS)
  createMealPlan(@Req() req: any, @Body() dto: any) {
    return this.kitchen.createMealPlan(req.user, dto);
  }

  @Post('meal-plans/:id/lock')
  @Roles(...MANAGERS)
  lockPlan(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.lockMealPlan(req.user, id);
  }

  @Post('meal-plans/:id/adjustments')
  @Roles(...MANAGERS)
  adjustPlan(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.kitchen.adjustBatch(req.user, id, dto);
  }

  @Post('batches/:id/start')
  @Roles(...OPERATORS)
  startBatch(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: KitchenBatchUpdateDto,
  ) {
    return this.operations.transition(req.user, id, dto, 'PREPARING');
  }

  @Get('batches/:id/adjustments')
  @Roles(...OPERATORS)
  batchAdjustments(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.listBatchAdjustments(req.user, id);
  }

  @Post('batches/:id/ready')
  @Roles(...OPERATORS)
  readyBatch(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: KitchenBatchUpdateDto,
  ) {
    return this.operations.transition(req.user, id, dto, 'READY');
  }

  @Post('batches/:id/complete')
  @Roles(...OPERATORS)
  completeBatch(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: KitchenBatchUpdateDto,
  ) {
    return this.operations.transition(req.user, id, dto, 'COMPLETED');
  }

  @Get('demand')
  @Roles(...OPERATORS)
  demand(@Req() req: any, @Query() query: any) {
    return this.kitchen.getDemand(req.user, query);
  }

  @Post('consumption-sessions')
  @Roles(...MANAGERS)
  createSession(@Req() req: any, @Body() dto: any) {
    return this.kitchen.createConsumptionSession(req.user, dto);
  }

  @Get('consumption-sessions')
  @Roles(...OPERATORS)
  sessions(@Req() req: any, @Query() query: any) {
    return this.kitchen.listConsumptionSessions(req.user, query);
  }

  @Get('consumption-sessions/:id')
  @Roles(...OPERATORS)
  session(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.getConsumptionSession(req.user, id);
  }

  @Post('consumption-sessions/:id/confirm')
  @Roles(...MANAGERS)
  confirmSession(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.kitchen.confirmConsumption(req.user, id, dto);
  }

  @Get('assignments')
  @Roles(...OPERATORS)
  assignments(@Req() req: any, @Query() query: any) {
    return this.kitchen.listAssignments(req.user, query);
  }

  @Post('assignments')
  @Roles(...MANAGERS)
  createAssignment(@Req() req: any, @Body() dto: any) {
    return this.kitchen.createAssignment(req.user, dto);
  }

  @Put('assignments/:id')
  @Roles(...MANAGERS)
  updateAssignment(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.kitchen.updateAssignment(req.user, id, dto);
  }

  @Delete('assignments/:id')
  @Roles(...MANAGERS)
  cancelAssignment(@Req() req: any, @Param('id') id: string) {
    return this.kitchen.cancelAssignment(req.user, id);
  }

  @Get('reports/operations')
  @Roles(...MANAGERS)
  report(@Req() req: any, @Query() query: any) {
    return this.kitchen.operationsReport(req.user, query);
  }
}
