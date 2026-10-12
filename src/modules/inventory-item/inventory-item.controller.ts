import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { UserType } from '../../common/enum/user-type.enum';
import { resolveStockBranch } from '../stock/stock-scope';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryItemService } from './inventory-item.service';

@ApiTags('Inventory Items')
@ApiBearerAuth()
@Controller('inventory-items')
@UseGuards(JwtAuthGuard)
export class InventoryItemController {
  constructor(private readonly inventoryItemService: InventoryItemService) {}

  @Get()
  @ApiOperation({
    summary: 'Compatibility inventory item list backed by products stock',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('productType') productType?: string,
  ) {
    return this.inventoryItemService.findAll(
      search,
      page,
      size,
      req.user?.branchId || branchId,
      productType,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by product ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiQuery({ name: 'branchId', required: false })
  async findOne(
    @Req() req: any,
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryItemService.findOne(
      id,
      req.user?.branchId || branchId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create inventory item as product stock record' })
  async create(@Req() req: any, @Body() dto: any) {
    dto.actorId = req.user.userId;
    dto.branchId = resolveStockBranch(req.user, dto.branchId);
    return this.inventoryItemService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Put(':id')
  @ApiOperation({ summary: 'Update inventory item stock fields' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    dto.actorId = req.user.userId;
    dto.branchId = resolveStockBranch(req.user, dto.branchId);
    return this.inventoryItemService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.ADMIN, UserType.MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate inventory item product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async delete(
    @Req() req: any,
    @Param('id') id: string,
    @Query('branchId') branchId?: string,
  ) {
    await this.inventoryItemService.findOne(
      id,
      resolveStockBranch(req.user, branchId),
    );
    await this.inventoryItemService.delete(id);
  }
}
