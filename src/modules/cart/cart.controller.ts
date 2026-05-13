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
    return this.cartService.getOrCreateCart(undefined, undefined, undefined, userId);
  }

  @ApiOperation({ summary: 'Get cart by ID' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiResponse({ status: 200, description: 'Cart details' })
  @Get(':id')
  async getCart(@Param('id') id: string) {
    return this.cartService.getCart(id);
  }

  @ApiOperation({ summary: 'Add item to cart' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @Post(':id/items')
  async addItem(
    @Param('id') id: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(id, dto.productId, dto.quantity, dto.note);
  }

  @ApiOperation({ summary: 'Add item to my cart (via JWT token)' })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @Post('me/items')
  async addItemToMyCart(@Req() req: any, @Body() dto: AddCartItemDto) {
    const userId = req.user?.userId;
    const cart = await this.cartService.getOrCreateCart(undefined, undefined, undefined, userId);
    return this.cartService.addItem(cart.id, dto.productId, dto.quantity, dto.note);
  }

  @ApiOperation({ summary: 'Update item quantity' })
  @ApiParam({ name: 'itemId', description: 'Cart Item ID' })
  @ApiResponse({ status: 200, description: 'Item updated' })
  @Put('items/:itemId')
  async updateItemQuantity(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(itemId, dto.quantity);
  }

  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiParam({ name: 'itemId', description: 'Cart Item ID' })
  @ApiResponse({ status: 200, description: 'Item removed' })
  @Delete('items/:itemId')
  async removeItem(@Param('itemId') itemId: string) {
    return this.cartService.removeItem(itemId);
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
