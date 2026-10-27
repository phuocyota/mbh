import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorator/public.decorator';
import { PublicFullTraceQueryDto } from './dto/full-trace-query.dto';
import { StockTraceService } from './stock-trace.service';

@ApiTags('Stock Traceability')
@Controller('stock-trace')
export class PublicStockTraceController {
  constructor(private readonly stockTraceService: StockTraceService) {}

  @Public()
  @Get('full')
  @ApiOperation({
    summary:
      'Truy xuất nguồn gốc tổng hợp công khai: lot + sản phẩm + chi nhánh + nguồn gốc (NCC/sản xuất) + movements + consumption + recipe + timeline',
  })
  getFullTrace(@Query() query: PublicFullTraceQueryDto) {
    return this.stockTraceService.getFullTrace(query);
  }
}
