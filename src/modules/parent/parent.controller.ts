import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParentService } from './parent.service';
import { ParentHomeResponseDto } from './dto/parent-home-response.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@ApiTags('Parent')
@Controller('api/parent')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Get('home')
  @ApiOperation({ summary: 'Get parent home data' })
  @ApiResponse({
    status: 200,
    description: 'Parent home data retrieved successfully',
    type: ParentHomeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getHome(@Req() req: AuthenticatedRequest): Promise<ParentHomeResponseDto> {
    const userId = req.user.userId;
    return this.parentService.getParentHome(userId);
  }
}
