import { logger } from './logger';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  label?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, label = 'operation' } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;

      // Handle Slack 429 rate limits
      let delay: number;
      if (error?.data?.retryAfter || error?.headers?.['retry-after']) {
        const retryAfter = error.data?.retryAfter || parseInt(error.headers['retry-after'], 10);
        delay = retryAfter * 1000;
        logger.warn(`${label}: rate limited, retrying after ${retryAfter}s`);
      } else {
        delay = Math.pow(2, attempt) * baseDelayMs;
        logger.warn(`${label}: attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Unreachable but satisfies TS
  throw new Error(`${label}: exhausted retries`);
}
