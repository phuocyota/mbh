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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private productService: ProductService) {}

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
    @Query('categoryId') categoryId?: string,
    @Query('branchId') branchId?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
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
      branchId,
      isCanteenItem: parseOptionalBoolean(isCanteenItem),
      search,
      displayStatus,
      stockStatus,
      page: page ? parseInt(page, 10) : undefined,
      size: size ? parseInt(size, 10) : limit ? parseInt(limit, 10) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get all product categories' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  @Get('categories')
  async findAllCategories(
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.productService.findAllCategories(page, size);
  }

  @ApiOperation({ summary: 'Get active categories with active products' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'isCanteenItem', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of categories with products' })
  @Get('full')
  async findAllCategoriesWithProducts(
    @Query('branchId') branchId?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('isCanteenItem') isCanteenItem?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.productService.findAllCategoriesWithProducts({
      branchId,
      minPrice,
      maxPrice,
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
  async findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @Post()
  async create(@Body() createProductDto: any) {
    return this.productService.createProduct(createProductDto);
  }

  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: any) {
    return this.productService.updateProduct(id, updateProductDto);
  }

  @ApiOperation({ summary: 'Bulk update products' })
  @ApiResponse({ status: 200, description: 'Products updated' })
  @Put('bulk/update')
  async updateBulk(@Body() items: { id: string; price: number }[]) {
    return this.productService.updateBulk(items, { userId: 'system' } as any);
  }

  @ApiOperation({ summary: 'Delete product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.productService.delete(id, { userId: 'system' } as any);
  }
}

function parseOptionalBoolean(value?: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === 'true';
}
