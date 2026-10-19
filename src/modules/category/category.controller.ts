import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CategoryDto } from './dto/category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  private resolveBranchId(req: any, queryBranchId?: string) {
    return req.user?.branchId || queryBranchId;
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
    type: [CategoryDto],
  })
  async findAll(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.categoryService.findAll(
      page,
      size,
      this.resolveBranchId(req, branchId),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category details',
    type: CategoryDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.categoryService.findOneInBranch(id, req.user.branchId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new category' })
  @ApiResponse({
    status: 201,
    description: 'Category created',
    type: CategoryDto,
  })
  async create(@Req() req: any, @Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(
      { ...createCategoryDto, branchId: req.user.branchId || null },
      req.user,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category updated',
    type: CategoryDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    await this.categoryService.findOneInBranch(id, req.user.branchId);
    return this.categoryService.update(
      id,
      { ...createCategoryDto, branchId: req.user.branchId || null },
      req.user,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 204, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async delete(@Req() req: any, @Param('id') id: string): Promise<void> {
    await this.categoryService.findOneInBranch(id, req.user.branchId);
    await this.categoryService.delete(id, req.user);
  }
}
