'use strict';

require('module-alias/register');

const { App, ExpressReceiver } = require('@slack/bolt');
const { loadConfig } = require('../../config');
const { initDatabase } = require('../../src/database');
const { seedUserMappings } = require('../../src/database/queries');
const { initGitHubClient } = require('../../src/clients/github');
const { createWebhookHandler } = require('../../src/service/github/webhook-handler');
const { initSlackClient } = require('../../src/service/slack/message-service');
const { createPRStatusHandler } = require('../../src/service/slack/commands');
const { registerAppHomeHandlers } = require('../../src/service/slack/app-home-handlers');
const { logger } = require('../../src/logger');

async function main() {
  const config = loadConfig();

  initDatabase();
  seedUserMappings(config.userMappings);
  logger.info('Database ready, user mappings seeded');

  initGitHubClient(config.githubToken);
  logger.info('GitHub client initialized');

  const receiver = new ExpressReceiver({
    signingSecret: config.slackSigningSecret,
    endpoints: '/slack/events',
  });

  const expressApp = receiver.app;

  expressApp.use('/github/webhook', (req, _res, next) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { rawBody += chunk; });
    req.on('end', () => {
      req.rawBody = rawBody;
      try {
        req.body = JSON.parse(rawBody);
      } catch {
        req.body = {};
      }
      next();
    });
  });

  expressApp.post('/github/webhook', createWebhookHandler(config));

  const app = new App({
    token: config.slackBotToken,
    receiver,
  });

  initSlackClient(app.client);
  registerAppHomeHandlers(app);
  logger.info('App Home handlers registered');

  app.command('/pr-status', createPRStatusHandler(config));

  expressApp.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  await app.start(config.port);
  logger.info(`PR-Bot running on port ${config.port}`);
  logger.info('Slack events: /slack/events');
  logger.info('GitHub webhooks: /github/webhook');
  logger.info('Health check: /health');
}

main().catch((error) => {
  logger.error('Failed to start PR-Bot', { error: error.message });
  process.exit(1);
});
