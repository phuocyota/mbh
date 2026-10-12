import { ForbiddenException } from '@nestjs/common';
import { resolveStockBranch } from '../stock/stock-scope';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { ProductWriteDto } from './product-write.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private productService: ProductService) {}

  private resolveBranchId(req: any, queryBranchId?: string) {
    return req.user?.branchId || queryBranchId;
  }

  @ApiOperation({ summary: 'Get all products' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'isCanteenItem', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of products' })
  @Get()
  async findAll(
    @Req() req: any,
    @Query('categoryId') categoryId?: string,
    @Query('branchId') branchId?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('productType') productType?: string,
    @Query('isCanteenItem') isCanteenItem?: string,
    @Query('search') search?: string,
    @Query('displayStatus') displayStatus?: string,
    @Query('stockStatus') stockStatus?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productService.findProducts(categoryId, {
      minPrice,
      maxPrice,
      branchId: this.resolveBranchId(req, branchId),
      productType,
      isCanteenItem: parseOptionalBoolean(isCanteenItem),
      search,
      displayStatus,
      stockStatus,
      page: page ? parseInt(page, 10) : undefined,
      size: size ? parseInt(size, 10) : limit ? parseInt(limit, 10) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get all product categories' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of categories' })
  @Get('categories')
  async findAllCategories(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.productService.findAllCategories(
      page,
      size,
      this.resolveBranchId(req, branchId),
    );
  }

  @ApiOperation({
    summary: 'Get active categories with products filtered by active status',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter products by active status; defaults to true',
  })
  @ApiQuery({
    name: 'hasInventory',
    required: false,
    type: Boolean,
    description:
      'When true, only return products with total stock quantity > 0',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'isCanteenItem', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of categories with products' })
  @Get('full')
  async findAllCategoriesWithProducts(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('productType') productType?: string,
    @Query('isCanteenItem') isCanteenItem?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('hasInventory') hasInventory?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.productService.findAllCategoriesWithProducts({
      hasInventory: parseOptionalBoolean(hasInventory),
      isActive: parseOptionalBoolean(isActive),
      branchId: this.resolveBranchId(req, branchId),
      minPrice,
      maxPrice,
      productType,
      isCanteenItem: parseOptionalBoolean(isCanteenItem),
      page,
      size,
    });
  }

  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (req.user.userType === 'ADMIN' && !req.user.branchId)
      return this.productService.findOne(id);
    return this.productService.findOneForBranch(
      id,
      resolveStockBranch(req.user),
    );
  }

  @ApiOperation({ summary: 'Create new product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @Post()
  async create(@Req() req: any, @Body() createProductDto: ProductWriteDto) {
    if (req.user.userType === 'KITCHEN')
      throw new ForbiddenException('MANAGER_REQUIRED');
    return this.productService.createProduct({
      ...createProductDto,
      createdBy: req.user.userId,
      branchId: this.resolveBranchId(req, createProductDto?.branchId),
    });
  }

  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateProductDto: ProductWriteDto,
  ) {
    if (req.user.userType === 'KITCHEN')
      throw new ForbiddenException('MANAGER_REQUIRED');
    const product = await this.productService.findOne(id);
    if (product.branchId) resolveStockBranch(req.user, product.branchId);
    if (updateProductDto.branchId)
      resolveStockBranch(req.user, updateProductDto.branchId);
    return this.productService.updateProduct(id, {
      ...updateProductDto,
      updatedBy: req.user.userId,
    });
  }

  @ApiOperation({ summary: 'Bulk update products' })
  @ApiResponse({ status: 200, description: 'Products updated' })
  @Put('bulk/update')
  async updateBulk(
    @Req() req: any,
    @Body() items: { id: string; price: number }[],
  ) {
    if (req.user.userType === 'KITCHEN')
      throw new ForbiddenException('MANAGER_REQUIRED');
    for (const item of items) {
      const product = await this.productService.findOne(item.id);
      if (product.branchId) resolveStockBranch(req.user, product.branchId);
    }
    return this.productService.updateBulk(items, { userId: req.user.userId });
  }

  @ApiOperation({ summary: 'Delete product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    if (req.user.userType === 'KITCHEN')
      throw new ForbiddenException('MANAGER_REQUIRED');
    const product = await this.productService.findOne(id);
    if (product.branchId) resolveStockBranch(req.user, product.branchId);
    return this.productService.delete(id, { userId: req.user.userId });
  }
}

function parseOptionalBoolean(value?: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === 'true';
}
