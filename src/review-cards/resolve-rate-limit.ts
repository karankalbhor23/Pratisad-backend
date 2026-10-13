const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkResolveRateLimit(ip: string): boolean {
  const key = ip || 'unknown';
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= MAX_PER_WINDOW) return false;
  existing.count += 1;
  return true;
}
