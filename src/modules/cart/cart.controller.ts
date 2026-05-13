import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CompleteCartDto } from './dto/complete-cart.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cartService: CartService) {}

  @ApiOperation({ summary: 'Get my cart from JWT token' })
  @ApiResponse({ status: 200, description: 'Cart retrieved' })
  @Get('me')
  async getMyCart(@Req() req: any) {
    const userId = req.user?.userId;
    return this.cartService.getMyCart(userId);
  }

  @ApiOperation({ summary: 'Add item to my cart (via JWT token)' })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @Post('me/items')
  async addItemToMyCart(@Req() req: any, @Body() dto: AddCartItemDto) {
    const userId = req.user?.userId;
    const cart = await this.cartService.getOrCreateCart(undefined, undefined, undefined, userId);
    return this.cartService.addItem(cart.id, dto.productId, dto.quantity, dto.note);
  }

  @ApiOperation({ summary: 'Update item quantity in my cart' })
  @ApiParam({ name: 'itemId', description: 'Cart Item ID' })
  @ApiResponse({ status: 200, description: 'Item updated' })
  @Put('me/items/:itemId')
  async updateItemQuantity(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const userId = req.user?.userId;
    const cart = await this.cartService.getOrCreateCart(undefined, undefined, undefined, userId);
    return this.cartService.updateItemQuantity(cart.id, itemId, dto.quantity);
  }

  @ApiOperation({ summary: 'Remove item from my cart' })
  @ApiParam({ name: 'itemId', description: 'Cart Item ID' })
  @ApiResponse({ status: 200, description: 'Item removed' })
  @Delete('me/items/:itemId')
  async removeItem(@Req() req: any, @Param('itemId') itemId: string) {
    const userId = req.user?.userId;
    const cart = await this.cartService.getOrCreateCart(undefined, undefined, undefined, userId);
    return this.cartService.removeItem(cart.id, itemId);
  }

  @ApiOperation({ summary: 'Complete my cart and create an order' })
  @ApiResponse({ status: 201, description: 'Order created from cart' })
  @Post('me/complete')
  async completeMyCart(@Req() req: any, @Body() dto: CompleteCartDto) {
    const userId = req.user?.userId;
    return this.cartService.completeCart(userId, dto);
  }

  @ApiOperation({ summary: 'Clear my cart (via JWT token)' })
  @ApiResponse({ status: 200, description: 'Cart cleared' })
  @Delete('me/clear')
  async clearMyCart(@Req() req: any) {
    const userId = req.user?.userId;
    const cart = await this.cartService.getOrCreateCart(undefined, undefined, undefined, userId);
    return this.cartService.clearCart(cart.id);
  }
}
