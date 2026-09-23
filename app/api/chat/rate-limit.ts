// import { Ratelimit } from "@upstash/ratelimit";
// import { Redis } from "@upstash/redis";

const FAIL_OPEN_MESSAGE = "[RATE-LIMIT] Redis unavailable, failing open";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  tier?: string;
};

type RateLimiters = {
  burst: Ratelimit;
  minute: Ratelimit;
  daily: Ratelimit;
  abuse: Ratelimit;
};

let limiters: RateLimiters | null = null;
let limitersStatus: "initialized" | "disabled" | "pending" = "pending";

function getLimiters(): RateLimiters | null {
  if (limitersStatus === "disabled") return null;
  if (limiters) return limiters;

  try {
    const redis = Redis.fromEnv();

    limiters = {
      burst: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "10 s"),
        analytics: true,
        prefix: "freakmount:burst",
      }),
      minute: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        analytics: true,
        prefix: "freakmount:minute",
      }),
      daily: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(200, "1 d"),
        analytics: true,
        prefix: "freakmount:daily",
      }),
      abuse: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: true,
        prefix: "freakmount:abuse",
      }),
    };

    limitersStatus = "initialized";
    return limiters;
  } catch (error) {
    limitersStatus = "disabled";
    console.error(`${FAIL_OPEN_MESSAGE}: initialization failed`, error);
    return null;
  }
}

function disabledResult(): RateLimitResult {
  return {
    success: true,
    limit: 0,
    remaining: 0,
    reset: Date.now() + 60_000,
    tier: "disabled",
  };
}

export async function checkRateLimits(
  identifier: string,
): Promise<RateLimitResult> {
  const limiters = getLimiters();

  if (!limiters) {
    return disabledResult();
  }

  try {
    const [burst, minute, daily] = await Promise.all([
      limiters.burst.limit(identifier),
      limiters.minute.limit(identifier),
      limiters.daily.limit(identifier),
    ]);

    if (!burst.success) {
      return { ...burst, tier: "burst" };
    }
    if (!minute.success) {
      return { ...minute, tier: "minute" };
    }
    if (!daily.success) {
      return { ...daily, tier: "daily" };
    }

    return { ...burst, tier: "ok" };
  } catch (error) {
    console.error(`${FAIL_OPEN_MESSAGE}: limit check failed`, error);
    return disabledResult();
  }
}

export async function recordAbuseAttempt(
  identifier: string,
): Promise<RateLimitResult> {
  const limiters = getLimiters();

  if (!limiters) {
    return disabledResult();
  }

  try {
    return await limiters.abuse.limit(identifier);
  } catch (error) {
    console.error(`${FAIL_OPEN_MESSAGE}: abuse limit check failed`, error);
    return disabledResult();
  }
}