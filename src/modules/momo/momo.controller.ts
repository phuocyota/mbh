import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MomoService } from './momo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MoMo Payment')
@ApiBearerAuth()
@Controller(['momo', 'api/momo'])
export class MomoController {
  constructor(private readonly momoService: MomoService) {}

  private getAuthenticatedUserId(req: any): string {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    return userId;
  }

  @Post('create/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create MoMo payment URL for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID to pay for' })
  @ApiResponse({ status: 201, description: 'Payment URL created' })
  @HttpCode(HttpStatus.CREATED)
  async createPayment(@Param('orderId') orderId: string, @Req() req: any) {
    return this.momoService.createPayment(
      orderId,
      this.getAuthenticatedUserId(req),
    );
  }

  @Post('topup')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create MoMo topup URL for a customer' })
  @ApiResponse({ status: 201, description: 'Topup URL created' })
  @HttpCode(HttpStatus.CREATED)
  async createTopup(
    @Body('customerId') customerId: string,
    @Body('amount') amount: number,
    @Req() req: any,
  ) {
    return this.momoService.createTopupPayment(
      customerId,
      amount,
      this.getAuthenticatedUserId(req),
    );
  }

  @Post('ipn')
  @ApiOperation({ summary: 'MoMo Webhook/IPN endpoint' })
  @ApiResponse({ status: 204, description: 'IPN processed successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async processIpn(@Body() ipnData: any) {
    await this.momoService.processIpn(ipnData);
  }
}

@ApiTags('MoMo Payment')
@Controller('payment-result')
export class MomoPaymentResultController {
  constructor(private readonly momoService: MomoService) {}

  @Get()
  @ApiOperation({ summary: 'MoMo redirect result endpoint' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend result page' })
  async processPaymentResult(@Query() resultData: any, @Res() res: Response) {
    await this.momoService.processIpn(resultData);
    const success = Number(resultData?.resultCode) === 0;
    const frontendResultUrl =
      process.env.MOMO_FE_RETURN_URL || 'http://localhost:5171/payment-result';
    const redirectUrl = new URL(frontendResultUrl);

    redirectUrl.searchParams.set('success', String(success));
    redirectUrl.searchParams.set('status', success ? 'SUCCESS' : 'FAILED');
    redirectUrl.searchParams.set(
      'message',
      success ? 'Payment successful' : 'Payment failed',
    );

    return res.redirect(HttpStatus.FOUND, redirectUrl.toString());
  }
}
