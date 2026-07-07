import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MomoService } from './momo.service';

@ApiTags('MoMo Payment')
@Controller('momo')
export class MomoController {
  constructor(private readonly momoService: MomoService) {}

  @Post('create/:orderId')
  @ApiOperation({ summary: 'Create MoMo payment URL for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID to pay for' })
  @ApiResponse({ status: 201, description: 'Payment URL created' })
  @HttpCode(HttpStatus.CREATED)
  async createPayment(@Param('orderId') orderId: string) {
    return this.momoService.createPayment(orderId);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Create MoMo topup URL for a customer' })
  @ApiResponse({ status: 201, description: 'Topup URL created' })
  @HttpCode(HttpStatus.CREATED)
  async createTopup(
    @Body('customerId') customerId: string,
    @Body('amount') amount: number,
  ) {
    return this.momoService.createTopupPayment(customerId, amount);
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
