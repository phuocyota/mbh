import {
  Controller,
  Get,
  Header,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { BranchDto } from './dto/branch.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchController {
  constructor(private branchService: BranchService) {}

  @Get()
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Get all branches' })
  @ApiResponse({
    status: 200,
    description: 'List of branches',
    type: [BranchDto],
  })
  async findAll(
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.branchService.findAll(page, size);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch details', type: BranchDto })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async findOne(@Param('id') id: string) {
    return this.branchService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new branch' })
  @ApiResponse({ status: 201, description: 'Branch created', type: BranchDto })
  async create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchService.create(createBranchDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 200, description: 'Branch updated', type: BranchDto })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async update(
    @Param('id') id: string,
    @Body() createBranchDto: CreateBranchDto,
  ) {
    return this.branchService.update(id, createBranchDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete branch' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @ApiResponse({ status: 204, description: 'Branch deleted' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.branchService.delete(id, { userId: 'system' } as any);
  }
}
