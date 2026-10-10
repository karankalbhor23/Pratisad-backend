import { HttpException, HttpStatus } from '@nestjs/common';
import { ReviewDraftThrottleGuard } from './review-draft-throttle.guard';

describe('ReviewDraftThrottleGuard', () => {
  it('returns 429 after ten requests from one IP', () => {
    const guard = new ReviewDraftThrottleGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', socket: {} }),
      }),
    } as never;
    for (let index = 0; index < 10; index += 1)
      expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });
});
