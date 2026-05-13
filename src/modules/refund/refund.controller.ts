import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RefundService } from './refund.service';
import {
  ApproveRefundDto,
  CreateRefundDto,
  RejectRefundDto,
} from './dto/create-refund.dto';
import { RefundDto } from './dto/refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Refunds')
@ApiBearerAuth()
@Controller('refunds')
export class RefundController {
  constructor(private refundService: RefundService) {}

  @Get()
  @ApiOperation({ summary: 'Get all refunds' })
  @ApiResponse({
    status: 200,
    description: 'List of refunds',
    type: [RefundDto],
  })
  async findAll() {
    return this.refundService.findAll();
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'Lấy danh sách refund theo order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  async findByOrder(@Param('orderId') orderId: string) {
    return this.refundService.findByOrder(orderId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get refund by ID (kèm items)' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({
    status: 200,
    description: 'Refund details with items',
  })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async findOne(@Param('id') id: string) {
    return this.refundService.findOneWithItems(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo phiếu hoàn tiền (status=PENDING, chờ duyệt)',
  })
  @ApiResponse({ status: 201, description: 'Refund created' })
  async create(
    @Body() createRefundDto: CreateRefundDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    return this.refundService.createRefund(createRefundDto, userId);
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Duyệt refund - hoàn ví (nếu thanh toán bằng WALLET) + cập nhật order',
  })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  async approve(
    @Param('id') id: string,
    @Body() _: ApproveRefundDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    return this.refundService.approveRefund(id, userId);
  }

  @Put(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Từ chối refund' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  async reject(
    @Param('id') id: string,
    @Body() body: RejectRefundDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId || 'system';
    return this.refundService.rejectRefund(id, userId, body.reason);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete refund' })
  @ApiParam({ name: 'id', description: 'Refund ID' })
  @ApiResponse({ status: 204, description: 'Refund deleted' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.refundService.delete(id, { userId: 'system' } as any);
  }
}
