import { ConflictException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from '../../common/filter/all-exceptions.filter';

describe('trace ambiguity HTTP response', () => {
  it('preserves scoped choices through the global exception filter', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const json = jest.fn();
    const response = { status: jest.fn(() => ({ json })) };
    const request = {
      url: '/production-trace/lookup?id=SER',
      method: 'GET',
      headers: {},
      user: { userId: 'actor' },
    };
    const host: any = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    };
    try {
      new AllExceptionsFilter().catch(
        new ConflictException({
          code: 'TRACE_ID_AMBIGUOUS',
          message: 'Chọn bản ghi',
          matches: [{ detailId: 'detail', position: 1 }],
          total: 2,
        }),
        host,
      );
      expect(response.status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TRACE_ID_AMBIGUOUS',
          matches: [{ detailId: 'detail', position: 1 }],
          total: 2,
        }),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
