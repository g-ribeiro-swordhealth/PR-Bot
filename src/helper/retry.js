'use strict';

const { logger } = require('../logger');

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxRetries?: number, baseDelayMs?: number, label?: string }} [options]
 * @returns {Promise<T>}
 */
async function withRetry(fn, options = {}) {
  const { maxRetries = 3, baseDelayMs = 1000, label = 'operation' } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      let delay;
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

  throw new Error(`${label}: exhausted retries`);
}

module.exports = { withRetry };
