import { GoogleReviewsService } from './google-reviews.service';

describe('GoogleReviewsService scheduled lock', () => {
  function createService(lockValue: boolean, businesses: Array<{ id: string }> = []) {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: lockValue }]),
      business: { findMany: jest.fn().mockResolvedValue(businesses) },
    };
    const prisma: any = {
      $transaction: jest.fn(async (work: (client: unknown) => Promise<void>) => work(tx)),
      $executeRaw: jest.fn(),
    };
    const service = new GoogleReviewsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, prisma, tx };
  }

  it('acquires a transaction-scoped advisory lock and never issues a separate unlock', async () => {
    const { service, prisma, tx } = createService(true);

    await service.runScheduledSync();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = tx.$queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain('pg_try_advisory_xact_lock');
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('does no scheduled work when another transaction holds the lock', async () => {
    const { service, tx } = createService(false, [{ id: 'business-1' }]);

    await service.runScheduledSync();

    expect(tx.business.findMany).not.toHaveBeenCalled();
  });
});
