'use strict';

const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = process.env.LOG_LEVEL || 'info';

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [data]
 */
function log(level, message, data) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (data) {
    console[level === 'debug' ? 'log' : level](prefix, message, JSON.stringify(data));
  } else {
    console[level === 'debug' ? 'log' : level](prefix, message);
  }
}

const logger = {
  debug: (msg, data) => log('debug', msg, data),
  info: (msg, data) => log('info', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  error: (msg, data) => log('error', msg, data),
};

module.exports = { logger };
