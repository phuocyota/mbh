import { KitchenScheduler } from './kitchen.scheduler';

describe('Kitchen scheduler notification recovery', () => {
  it('still reconciles recipe blockers when another kitchen job fails', async () => {
    const kitchen = {
      lockDuePlans: jest.fn().mockRejectedValue(new Error('locked shift')),
      reconcilePaidTickets: jest.fn().mockResolvedValue({ created: 0 }),
      reconcileProductionRecipeRequests: jest.fn().mockResolvedValue({ changed: 1 }),
    };
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await (new KitchenScheduler(kitchen as any) as any).run();
      expect(kitchen.reconcilePaidTickets).toHaveBeenCalledTimes(1);
      expect(kitchen.reconcileProductionRecipeRequests).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
    } finally {
      log.mockRestore();
    }
  });
});
