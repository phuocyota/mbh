import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Roles } from '../../common/decorator/roles.decorator';
import { UserType } from '../../common/enum/user-type.enum';
import { StockTraceService } from './stock-trace.service';
import {
  CreateProductRecipeDto,
  UpdateProductRecipeDto,
  RecipeQueryDto,
} from './dto/product-recipe.dto';
import {
  LotMovementQueryDto,
  ProductLotsQueryDto,
  IngredientTraceQueryDto,
  TraceabilityReportQueryDto,
  ExpiringLotsQueryDto,
  ConsumedLotsQueryDto,
} from './dto/trace-query.dto';

@ApiTags('Stock Traceability')
@ApiBearerAuth()
@Controller('stock-trace')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockTraceController {
  constructor(private readonly stockTraceService: StockTraceService) {}

  // ============================================
  // LOT TRACEABILITY ENDPOINTS
  // ============================================

  @Get('lots/:lotId')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
  @ApiOperation({ summary: 'Get detailed lot information' })
  async getLotDetails(@Param('lotId') lotId: string) {
    return this.stockTraceService.getLotDetails(lotId);
  }

  @Get('lots/:lotId/movements')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Get movements for a specific lot' })
  async getLotMovements(
    @Param('lotId') lotId: string,
    @Query() query: LotMovementQueryDto,
  ) {
    return this.stockTraceService.getLotMovements(lotId, query);
  }

  @Get('lots/:lotId/status-at')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Get lot status at a historical point in time' })
  async getLotStatusAt(
    @Param('lotId') lotId: string,
    @Query('asOf') asOfDate: string,
  ) {
    return this.stockTraceService.getLotStatusAt(
      lotId,
      new Date(asOfDate),
    );
  }

  @Get('lots/:lotId/supplier')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Trace lot back to supplier import' })
  async traceToSupplier(@Param('lotId') lotId: string) {
    return this.stockTraceService.traceToSupplier(lotId);
  }

  @Get('products/:productId/lots')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
  @ApiOperation({ summary: 'Get all lots for a product' })
  async getProductLots(
    @Param('productId') productId: string,
    @Query() query: ProductLotsQueryDto,
  ) {
    return this.stockTraceService.getProductLots(productId, query);
  }

  // ============================================
  // SOURCE TRACEABILITY ENDPOINTS
  // ============================================

  @Get('movements/:movementId/chain')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Trace movement chain forward or backward' })
  async traceMovementChain(
    @Param('movementId') movementId: string,
    @Query('direction') direction: 'FORWARD' | 'BACKWARD' | 'BOTH' = 'BOTH',
  ) {
    return this.stockTraceService.traceMovementChain(movementId, direction);
  }

  @Get('products/:productId/trace')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Comprehensive product traceability' })
  async traceProduct(
    @Param('productId') productId: string,
    @Query() query: ProductLotsQueryDto,
  ) {
    return this.stockTraceService.traceProduct(productId, {
      branchId: query.branchId,
    });
  }

  @Get('summary/inbound')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Inbound stock summary with supplier attribution' })
  async getInboundSummary(@Query() query: {
    branchId?: string;
    from?: string;
    to?: string;
    supplierId?: string;
  }) {
    return this.stockTraceService.getInboundSummary(query);
  }

  // ============================================
  // INGREDIENT/BOM TRACEABILITY ENDPOINTS
  // ============================================

  @Get('recipes/:productId')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
  @ApiOperation({ summary: 'Get Bill of Materials for a product' })
  async getProductRecipe(
    @Param('productId') productId: string,
    @Query() query: RecipeQueryDto,
  ) {
    return this.stockTraceService.getProductRecipe(productId, query.version);
  }

  @Get('recipes/:productId/history')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Get all recipe versions for a product' })
  async getProductRecipes(
    @Param('productId') productId: string,
    @Query() query: RecipeQueryDto,
  ) {
    return this.stockTraceService.getProductRecipes(productId, query.branchId);
  }

  @Post('recipes')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Create or update a product recipe (BOM)' })
  async createRecipe(
    @Body() dto: CreateProductRecipeDto,
    @Req() req: any,
  ) {
    return this.stockTraceService.createOrUpdateRecipe(dto, req.user?.userId);
  }

  @Put('recipes/:productId/activate')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Activate a specific recipe version' })
  async activateRecipe(
    @Param('productId') productId: string,
    @Query('version') version: number,
    @Req() req: any,
  ) {
    return this.stockTraceService.activateRecipe(
      productId,
      version,
      req.user?.userId,
    );
  }

  @Get('recipes/:productId/ingredients')
  @Roles(UserType.ADMIN, UserType.MANAGER, UserType.KITCHEN)
  @ApiOperation({ summary: 'Trace from finished product to ingredients' })
  async traceIngredients(
    @Param('productId') productId: string,
    @Query() query: IngredientTraceQueryDto,
  ) {
    return this.stockTraceService.traceIngredients(productId, query);
  }

  @Get('consumed-lots')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Find lots consumed for a finished good' })
  async getConsumedLots(@Query() query: ConsumedLotsQueryDto) {
    return this.stockTraceService.getConsumedLots(query);
  }

  // ============================================
  // REPORTING ENDPOINTS
  // ============================================

  @Get('reports/traceability')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Generate comprehensive traceability report' })
  async getTraceabilityReport(@Query() query: TraceabilityReportQueryDto) {
    return this.stockTraceService.generateTraceabilityReport(query);
  }

  @Get('reports/expiring')
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @ApiOperation({ summary: 'Report of lots expiring within date range' })
  async getExpiringLotsReport(@Query() query: ExpiringLotsQueryDto) {
    return this.stockTraceService.getExpiringLots(query);
  }
}
