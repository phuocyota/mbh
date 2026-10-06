import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { UserType } from '../../common/enum/user-type.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateVietinBankAccountDto,
  CreateVietinBankConfigDto,
  UpdateVietinBankAccountDto,
  UpdateVietinBankConfigDto,
  UpdateVietinBankSecretsDto,
  UpdateVietinBankStatusDto,
} from './dto/vietinbank-config.dto';
import type { VietinBankEnvironment } from '../../entities/vietinbank-integration-config.entity';
import { VietinBankConfigService } from './vietinbank-config.service';

interface AdminRequest extends Request {
  user: { userId: string; userType: string };
}

function success<T>(code: string, message: string, data: T) {
  return { success: true, code, message, data };
}

@ApiTags('VietinBank Configuration')
@ApiBearerAuth()
@Controller('api/v1/vietinbank')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.ADMIN)
export class VietinBankConfigController {
  constructor(private readonly configService: VietinBankConfigService) {}

  @Post('configs')
  async create(
    @Body() dto: CreateVietinBankConfigDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.configService.create(dto, request.user.userId);
    return success('SUCCESS', 'VietinBank config created', data);
  }

  @Get('configs')
  async findAll(
    @Query('branchId', new ParseUUIDPipe({ optional: true })) branchId?: string,
    @Query(
      'environment',
      new ParseEnumPipe(['UAT', 'PROD'], { optional: true }),
    )
    environment?: VietinBankEnvironment,
  ) {
    const data = await this.configService.findAll(branchId, environment);
    return success('SUCCESS', 'VietinBank configs retrieved', data);
  }

  @Get('configs/:id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.configService.findOne(id);
    return success('SUCCESS', 'VietinBank config retrieved', data);
  }

  @Patch('configs/:id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVietinBankConfigDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.configService.update(id, dto, request.user.userId);
    return success('SUCCESS', 'VietinBank config updated', data);
  }

  @Patch('configs/:id/secrets')
  async updateSecrets(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVietinBankSecretsDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.configService.updateSecrets(
      id,
      dto,
      request.user.userId,
    );
    return success('SUCCESS', 'VietinBank secret references updated', data);
  }

  @Patch('configs/:id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVietinBankStatusDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.configService.updateStatus(
      id,
      dto,
      request.user.userId,
    );
    return success('SUCCESS', 'VietinBank config status updated', data);
  }

  @Delete('configs/:id')
  async disable(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AdminRequest,
  ) {
    const data = await this.configService.disable(id, request.user.userId);
    return success('SUCCESS', 'VietinBank config disabled', data);
  }

  @Post('configs/:configId/accounts')
  async addAccount(
    @Param('configId', new ParseUUIDPipe()) configId: string,
    @Body() dto: CreateVietinBankAccountDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.configService.addAccount(
      configId,
      dto,
      request.user.userId,
    );
    return success('SUCCESS', 'VietinBank account created', data);
  }

  @Get('configs/:configId/accounts')
  async listAccounts(@Param('configId', new ParseUUIDPipe()) configId: string) {
    const data = await this.configService.listAccounts(configId);
    return success('SUCCESS', 'VietinBank accounts retrieved', data);
  }

  @Patch('accounts/:id')
  async updateAccount(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVietinBankAccountDto,
    @Req() request: AdminRequest,
  ) {
    const data = await this.configService.updateAccount(
      id,
      dto,
      request.user.userId,
    );
    return success('SUCCESS', 'VietinBank account updated', data);
  }
}
