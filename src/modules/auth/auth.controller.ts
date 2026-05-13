import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CardLoginDto } from './dto/card-login.dto';
import { StudentLoginDto } from './dto/student-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
        fullName: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @Post('register')
  async register(
    @Body()
    registerDto: {
      email: string;
      password: string;
      fullName: string;
    },
  ) {
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.fullName,
    );
  }

  @ApiOperation({ summary: 'Login with card ID' })
  @ApiBody({ type: CardLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Card not found or inactive' })
  @Post('login-card')
  async loginByCard(@Body() dto: CardLoginDto) {
    return this.authService.loginByCard(dto.cardId);
  }

  @ApiOperation({ summary: 'Student login with card or email/password' })
  @ApiBody({ type: StudentLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Student login successful, returns JWT token',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Only students can use this endpoint' })
  @Post('login/student')
  async loginStudent(@Body() dto: StudentLoginDto) {
    return this.authService.loginStudent(dto);
  }
}
