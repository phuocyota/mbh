import { Controller, Post, Body, HttpCode, HttpStatus, Param } from '@nestjs/common';
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

  @Post('ipn')
  @ApiOperation({ summary: 'MoMo Webhook/IPN endpoint' })
  @ApiResponse({ status: 204, description: 'IPN processed successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async processIpn(@Body() ipnData: any) {
    await this.momoService.processIpn(ipnData);
  }
}
