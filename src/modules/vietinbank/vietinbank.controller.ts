import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VietinBankNotifyDto } from './dto/vietinbank.dto';
import { VietinBankService } from './vietinbank.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; branchId: string | null };
}

@ApiTags('VietinBank Topup')
@Controller('api/v1/vietinbank')
export class VietinBankController {
  constructor(private readonly vietinBankService: VietinBankService) {}

  @Post('generate-qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a VietinBank QR to refill parent wallet' })
  @ApiResponse({ status: 201, description: 'QR created or no topup needed' })
  async createTopupQr(@Req() request: AuthenticatedRequest) {
    const data = await this.vietinBankService.createTopupQr(
      request.user.userId,
      request.user.branchId,
    );
    return {
      success: true,
      code: data.code,
      message:
        data.code === 'NO_TOPUP_NEEDED'
          ? 'Wallet has reached the target balance'
          : 'QR generated',
      data,
    };
  }

  @Get('topups/:requestId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated parent topup status' })
  @ApiResponse({ status: 200, description: 'Topup status' })
  async getTopupStatus(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    const data = await this.vietinBankService.getTopupStatus(
      request.user.userId,
      requestId,
    );
    return {
      success: true,
      code: 'SUCCESS',
      message: 'Topup status retrieved',
      data,
    };
  }

  @Post('notify-bill')
  @ApiOperation({ summary: 'Receive a signed VietinBank credit notification' })
  @ApiBody({ type: VietinBankNotifyDto })
  @ApiResponse({ status: 200, description: 'Raw VietinBank response schema' })
  async notifyBill(
    @Body() body: Record<string, unknown>,
    @Res() response: Response,
  ): Promise<void> {
    // Keep the callback body untransformed: its exact string fields form the
    // VietinBank signature source and validation is performed by the service.
    const result = await this.vietinBankService.processNotify(
      body as unknown as VietinBankNotifyDto,
    );
    response.status(200).json(result);
  }
}
