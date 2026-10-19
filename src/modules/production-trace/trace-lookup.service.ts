import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import { StockSerialService } from '../stock/stock-serial.service';
import { StockTraceService } from '../stock-trace/stock-trace.service';

@Injectable()
export class TraceLookupService {
  constructor(
    private readonly db: DataSource,
    private readonly serials: StockSerialService,
    private readonly trace: StockTraceService,
  ) {}
  async lookup(branchId: string, value: unknown) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 128)
      throw new BadRequestException(
        'Vui lòng gửi ID lô hoặc số serial hợp lệ (tối đa 128 ký tự).',
      );
    const id = value.trim();
    // UUID-shaped serials (including AUTO) must still be searched as serials.
    const lots = isUUID(id)
      ? await this.db.query(
          'SELECT l.id FROM stock_lots l JOIN stocks s ON s.id=l.stock_id WHERE l.id=$1::uuid AND s.branch_id=$2::uuid',
          [id, branchId],
        )
      : [];
    const matches = await this.serials.list(branchId, { serial: id, size: 20 });
    if (lots.length + matches.total > 1) {
      throw new ConflictException({
        code: 'TRACE_ID_AMBIGUOUS',
        message:
          'ID khớp nhiều bản ghi. Vui lòng chọn đúng lô hoặc serial theo sản phẩm và phiếu nhập.',
        matches: [
          ...lots.map((l) => ({ type: 'LOT', lotId: l.id })),
          ...matches.data.map((s) => ({
            type: 'SERIAL',
            detailId: s.detailId,
            position: s.position,
            serial: s.serial,
            productId: s.productId,
            productName: s.productName,
            receiptCode: s.receiptCode,
            lotId: s.lotId,
          })),
        ],
        total: lots.length + matches.total,
      });
    }
    if (lots.length)
      return {
        type: 'LOT',
        id: lots[0].id,
        trace: await this.trace.getFullTrace({ lotId: lots[0].id }),
      };
    if (!matches.total)
      throw new NotFoundException(
        'Không tìm thấy lô hoặc serial trong chi nhánh.',
      );
    const serial = {
      ...matches.data[0],
      serialMovementTrackingSupported: false,
    };
    return {
      type: 'SERIAL',
      id: serial.serial,
      serial,
      lotTrace: serial.lotId
        ? await this.trace.getFullTrace({ lotId: serial.lotId })
        : null,
    };
  }
}
