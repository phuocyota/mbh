import { defaultFreshFoodExpiry } from './stock-import-expiry';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMaterialImportDto } from './dto/create-material-import.dto';
import { CreateStockVoucherDto } from './dto/create-stock-voucher.dto';

describe('fresh food expiry', () => {
  it.each([
    ['2026-10-19', '2026-10-26'],
    ['2026-12-29', '2027-01-05'],
    ['2028-02-25', '2028-03-03'],
  ])('defaults to seven calendar days after %s', (purchasedAt, expiresAt) => {
    expect(defaultFreshFoodExpiry(true, purchasedAt)).toBe(expiresAt);
  });
  it('preserves explicit expiry dates and does not default other products', () => {
    expect(defaultFreshFoodExpiry(true, '2026-10-19', '2026-10-22')).toBe(
      '2026-10-22',
    );
    expect(defaultFreshFoodExpiry(false, '2026-10-19')).toBeUndefined();
  });
  it.each([CreateMaterialImportDto, CreateStockVoucherDto])(
    'validates the purchase calendar date',
    async (dtoClass: any) => {
      for (const purchasedAt of ['2026-02-30', '2026-10-19T12:00:00Z', 'bad']) {
        const errors = await validate(
          plainToInstance(dtoClass, { purchasedAt }),
        );
        expect(errors.some((error) => error.property === 'purchasedAt')).toBe(
          true,
        );
      }
      const errors = await validate(
        plainToInstance(dtoClass, { purchasedAt: '2026-10-19' }),
      );
      expect(errors.some((error) => error.property === 'purchasedAt')).toBe(
        false,
      );
    },
  );
});
