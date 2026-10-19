import { saleDescription } from './sale-description';

describe('Sale voucher descriptions', () => {
  it('uses distinct export and receipt descriptions with the same order code', () => {
    expect(saleDescription('export', 'ABC123')).toBe(
      'Xuất bán theo đơn ABC123',
    );
    expect(saleDescription('receipt', 'ABC123')).toBe(
      'Thu tiền đơn hàng ABC123',
    );
  });
  it('replaces technical and old export notes when displaying a receipt', () => {
    expect(saleDescription('receipt', 'ABC123', 'STOCK_EXPORT')).toBe(
      'Thu tiền đơn hàng ABC123',
    );
    expect(
      saleDescription('receipt', 'ABC123', 'Xuất kho theo đơn hàng ABC123'),
    ).toBe('Thu tiền đơn hàng ABC123');
  });
  it('preserves user notes through storage and repeated presentation', () => {
    const saved = saleDescription('export', 'XK123', 'Giao tại quầy');
    expect(saved).toBe('Xuất bán theo đơn XK123\nGhi chú: Giao tại quầy');
    expect(saleDescription('export', 'XK123', saved)).toBe(saved);
    expect(saleDescription('receipt', 'XK123', saved)).toBe(
      'Thu tiền đơn hàng XK123\nGhi chú: Giao tại quầy',
    );
  });
});
