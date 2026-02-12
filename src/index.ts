import { App, ExpressReceiver } from '@slack/bolt';
import { loadConfig } from './config';
import { initDatabase } from './db/database';
import { seedUserMappings } from './db/queries';
import { initGitHubClient } from './github/client';
import { createWebhookHandler } from './github/webhook-handler';
import { initSlackClient } from './slack/message-service';
import { createPRStatusHandler } from './slack/commands';
import { registerAppHomeHandlers } from './slack/app-home-handlers';
import { logger } from './utils/logger';

async function main() {
  const config = loadConfig();

  // Init database
  initDatabase();
  seedUserMappings(config.userMappings);
  logger.info('Database ready, user mappings seeded');

  // Init GitHub client
  initGitHubClient(config.githubToken);
  logger.info('GitHub client initialized');

  // Create Express receiver (shares port for Slack + GitHub webhooks)
  const receiver = new ExpressReceiver({
    signingSecret: config.slackSigningSecret,
    endpoints: '/slack/events',
  });

  // Mount raw body parser for GitHub webhook signature verification
  const expressApp = receiver.app;
  expressApp.use('/github/webhook', (req, _res, next) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { rawBody += chunk; });
    req.on('end', () => {
      (req as any).rawBody = rawBody;
      // Parse JSON body manually
      try {
        req.body = JSON.parse(rawBody);
      } catch {
        req.body = {};
      }
      next();
    });
  });

  // Mount GitHub webhook endpoint
  expressApp.post('/github/webhook', createWebhookHandler(config));

  // Create Bolt app
  const app = new App({
    token: config.slackBotToken,
    receiver,
  });

  // Init Slack client for message-service
  initSlackClient(app.client);

  // Register App Home handlers (configuration UI)
  registerAppHomeHandlers(app);
  logger.info('App Home handlers registered');

  // Register slash command
  app.command('/pr-status', createPRStatusHandler(config));

  // Health check
  expressApp.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start
  await app.start(config.port);
  logger.info(`PR-Bot running on port ${config.port}`);
  logger.info(`Slack events: /slack/events`);
  logger.info(`GitHub webhooks: /github/webhook`);
  logger.info(`Health check: /health`);
}

main().catch((error) => {
  logger.error('Failed to start PR-Bot', { error: error.message });
  process.exit(1);
});
