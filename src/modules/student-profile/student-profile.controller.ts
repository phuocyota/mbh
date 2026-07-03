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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { StudentProfileService } from './student-profile.service';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';
import { StudentProfileDto } from './dto/student-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Student Profiles')
@ApiBearerAuth()
@Controller('student-profiles')
export class StudentProfileController {
  constructor(private studentProfileService: StudentProfileService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all student profiles' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of student profiles',
    type: [StudentProfileDto],
  })
  async findAll(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.studentProfileService.findAll(
      page,
      size,
      req.user?.branchId || branchId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student profile by ID' })
  @ApiParam({ name: 'id', description: 'Student Profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Student profile details',
    type: StudentProfileDto,
  })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  async findOne(@Param('id') id: string) {
    return this.studentProfileService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new student profile' })
  @ApiResponse({
    status: 201,
    description: 'Student profile created',
    type: StudentProfileDto,
  })
  async create(@Body() createStudentProfileDto: CreateStudentProfileDto) {
    return this.studentProfileService.create(createStudentProfileDto, {
      userId: 'system',
    } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update student profile' })
  @ApiParam({ name: 'id', description: 'Student Profile ID' })
  @ApiResponse({
    status: 200,
    description: 'Student profile updated',
    type: StudentProfileDto,
  })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  async update(
    @Param('id') id: string,
    @Body() createStudentProfileDto: CreateStudentProfileDto,
  ) {
    return this.studentProfileService.update(id, createStudentProfileDto, {
      userId: 'system',
    } as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete student profile' })
  @ApiParam({ name: 'id', description: 'Student Profile ID' })
  @ApiResponse({ status: 204, description: 'Student profile deleted' })
  @ApiResponse({ status: 404, description: 'Student profile not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.studentProfileService.delete(id, { userId: 'system' } as any);
  }
}
