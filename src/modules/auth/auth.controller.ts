import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CashierLoginDto } from './dto/cashier-login.dto';
import { StudentLoginDto } from './dto/student-login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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

  @ApiOperation({ summary: 'Student login with card or email/password' })
  @ApiBody({ type: StudentLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Student login successful, returns JWT token',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Only students can use this endpoint',
  })
  @Post('login/student')
  async loginStudent(@Body() dto: StudentLoginDto) {
    return this.authService.loginStudent(dto);
  }

  @ApiOperation({ summary: 'Cashier login with email/password' })
  @ApiBody({ type: CashierLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Cashier login successful, returns JWT token',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Only cashiers can use this endpoint',
  })
  @Post('login/cashier')
  async loginCashier(@Body() dto: CashierLoginDto) {
    return this.authService.loginCashier(dto);
  }
}
