import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrderService } from './order.service';
import { KioskCheckoutDto } from './dto/kiosk-checkout.dto';
import { CustomerService } from '../customer/customer.service';

@ApiTags('Kiosk')
@Controller('kiosk')
export class KioskController {
  constructor(
    private orderService: OrderService,
    private customerService: CustomerService,
  ) {}

  @Get('card/:cardUid')
  @ApiOperation({
    summary: 'Quét thẻ → trả về thông tin customer + ví (public, không JWT)',
  })
  @ApiParam({ name: 'cardUid' })
  async lookupByCard(@Param('cardUid') cardUid: string) {
    return this.customerService.findByCardUid(cardUid);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Self-service checkout: trừ ví + tạo order + gửi bếp (atomic, public)',
  })
  @ApiResponse({ status: 200, description: 'Order tạo thành công' })
  @ApiResponse({ status: 400, description: 'Thẻ/ví/sản phẩm không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Thẻ không tồn tại' })
  async checkout(@Body() dto: KioskCheckoutDto) {
    return this.orderService.kioskCheckout(dto);
  }
}
