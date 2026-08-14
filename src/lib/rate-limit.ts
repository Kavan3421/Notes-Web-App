/**
 * Simple in-memory sliding window rate limiter for brute-force protection.
 * Tracks failed attempts per key (e.g., IP address + share token hash).
 * 
 * In production with multiple application instances, replace this in-memory store
 * with Redis / Upstash Redis for distributed rate limiting across servers.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup expired records every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Checks and updates rate limit for a specific identifier key.
 * 
 * @param key Unique key, e.g. `pw_attempt:${ip}:${tokenHash}`
 * @param maxAttempts Maximum allowed attempts in the window (default: 5)
 * @param windowMs Time window in milliseconds (default: 15 minutes)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // First attempt or expired window
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - record.count - 1,
    resetInSeconds: Math.ceil((record.resetTime - now) / 1000),
  };
}

/**
 * Records a failed attempt for the given key.
 */
export function recordFailedAttempt(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): void {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
  } else {
    record.count += 1;
  }
}

/**
 * Clears rate limit record upon a successful attempt.
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
