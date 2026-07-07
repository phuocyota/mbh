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
} from '@nestjs/common';
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
@Controller('momo')
export class MomoController {
  constructor(private readonly momoService: MomoService) {}

  @Post('create/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create MoMo payment URL for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID to pay for' })
  @ApiResponse({ status: 201, description: 'Payment URL created' })
  @HttpCode(HttpStatus.CREATED)
  async createPayment(@Param('orderId') orderId: string, @Req() req: any) {
    return this.momoService.createPayment(orderId, req.user?.userId);
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
      req.user?.userId,
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
  @ApiResponse({ status: 200, description: 'Payment result processed' })
  async processPaymentResult(@Query() resultData: any) {
    await this.momoService.processIpn(resultData);
    return {
      success: Number(resultData?.resultCode) === 0,
      orderId: resultData?.orderId,
      transId: resultData?.transId,
      message: resultData?.message,
    };
  }
}
