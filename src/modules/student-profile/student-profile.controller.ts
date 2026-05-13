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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { StudentProfileService } from './student-profile.service';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';
import { StudentProfileDto } from './dto/student-profile.dto';

@ApiTags('Student Profiles')
@ApiBearerAuth()
@Controller('student-profiles')
export class StudentProfileController {
  constructor(private studentProfileService: StudentProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get all student profiles' })
  @ApiResponse({
    status: 200,
    description: 'List of student profiles',
    type: [StudentProfileDto],
  })
  async findAll() {
    return this.studentProfileService.findAll();
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
