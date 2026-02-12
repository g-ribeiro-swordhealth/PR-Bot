import { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import {
  buildAppHomeView,
  buildAddMembersModal,
  buildRemoveMembersModal,
  buildAddReposModal,
  buildRemoveReposModal,
  buildSettingsModal,
} from './app-home';
import {
  getFullTeamConfig,
  upsertTeamConfig,
  addTeamMember,
  removeTeamMember,
  addTeamRepo,
  removeTeamRepo,
} from '../db/team-config';
import { logger } from '../utils/logger';

/**
 * Register all App Home handlers
 */
export function registerAppHomeHandlers(app: App): void {
  // Handle app_home_opened event
  app.event('app_home_opened', async ({ event, client }) => {
    try {
      const userId = event.user;

      // Get the user's current channel context
      // For simplicity, we'll use the user's DM channel as the channel_id
      // In a real app, you might want to store this differently
      const channelId = event.channel || userId;

      const config = getFullTeamConfig(channelId);
      const view = buildAppHomeView(channelId, config);

      await client.views.publish({
        user_id: userId,
        view,
      });

      logger.info('App Home opened', { userId, channelId });
    } catch (error: any) {
      logger.error('Error publishing App Home', { error: error.message });
    }
  });

  // Button: Open add members modal
  app.action('open_add_members_modal', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = body as BlockAction;
      const channelId = (action.actions[0] as any).value;

      await client.views.open({
        trigger_id: action.trigger_id,
        view: buildAddMembersModal(channelId),
      });
    } catch (error: any) {
      logger.error('Error opening add members modal', { error: error.message });
    }
  });

  // Button: Open remove members modal
  app.action('open_remove_members_modal', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = body as BlockAction;
      const channelId = (action.actions[0] as any).value;
      const config = getFullTeamConfig(channelId);

      if (!config || config.members.length === 0) {
        // No members to remove
        return;
      }

      await client.views.open({
        trigger_id: action.trigger_id,
        view: buildRemoveMembersModal(channelId, config.members),
      });
    } catch (error: any) {
      logger.error('Error opening remove members modal', { error: error.message });
    }
  });

  // Button: Open add repos modal
  app.action('open_add_repos_modal', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = body as BlockAction;
      const channelId = (action.actions[0] as any).value;

      await client.views.open({
        trigger_id: action.trigger_id,
        view: buildAddReposModal(channelId),
      });
    } catch (error: any) {
      logger.error('Error opening add repos modal', { error: error.message });
    }
  });

  // Button: Open remove repos modal
  app.action('open_remove_repos_modal', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = body as BlockAction;
      const channelId = (action.actions[0] as any).value;
      const config = getFullTeamConfig(channelId);

      if (!config || config.repos.length === 0) {
        // No repos to remove
        return;
      }

      await client.views.open({
        trigger_id: action.trigger_id,
        view: buildRemoveReposModal(channelId, config.repos),
      });
    } catch (error: any) {
      logger.error('Error opening remove repos modal', { error: error.message });
    }
  });

  // Button: Open settings modal
  app.action('open_settings_modal', async ({ ack, body, client }) => {
    await ack();

    try {
      const action = body as BlockAction;
      const channelId = (action.actions[0] as any).value;
      const config = getFullTeamConfig(channelId);

      if (!config) {
        // No config yet, create default
        upsertTeamConfig({ channel_id: channelId });
        const newConfig = getFullTeamConfig(channelId);
        if (!newConfig) return;

        await client.views.open({
          trigger_id: action.trigger_id,
          view: buildSettingsModal(channelId, newConfig),
        });
      } else {
        await client.views.open({
          trigger_id: action.trigger_id,
          view: buildSettingsModal(channelId, config),
        });
      }
    } catch (error: any) {
      logger.error('Error opening settings modal', { error: error.message });
    }
  });

  // Modal submission: Add members
  app.view('add_members_submit', async ({ ack, view, body, client }) => {
    await ack();

    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const membersText = view.state.values.members_input.members.value || '';

      // Parse entries: "github-username:@slack-user" or just "github-username"
      const entries = membersText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      // Ensure config exists
      upsertTeamConfig({ channel_id: channelId });

      // Add each member with optional Slack mapping
      for (const entry of entries) {
        if (entry.includes(':')) {
          // Format: github-username:@slack-user or github-username:U01234
          const [githubUsername, slackPart] = entry.split(':').map(s => s.trim());

          // Extract Slack user ID from mention format <@U123> or @username or plain U123
          let slackUserId: string | undefined;
          if (slackPart.startsWith('<@') && slackPart.endsWith('>')) {
            // Format: <@U01234>
            slackUserId = slackPart.slice(2, -1);
          } else if (slackPart.startsWith('@')) {
            // Format: @username - we need to resolve this to user ID
            // For now, we'll skip resolution and just note it
            // In production, you'd call users.list to find by display name
            logger.warn('Slack username format not supported yet, use User ID or mention', { slackPart });
          } else if (slackPart.startsWith('U')) {
            // Format: U01234 (direct user ID)
            slackUserId = slackPart;
          }

          addTeamMember(channelId, githubUsername, slackUserId, userId);
        } else {
          // Just GitHub username, no Slack mapping
          addTeamMember(channelId, entry, undefined, userId);
        }
      }

      logger.info('Team members added', { channelId, entries, addedBy: userId });

      // Refresh App Home
      const config = getFullTeamConfig(channelId);
      await client.views.publish({
        user_id: userId,
        view: buildAppHomeView(channelId, config),
      });
    } catch (error: any) {
      logger.error('Error adding team members', { error: error.message });
    }
  });

  // Modal submission: Remove members
  app.view('remove_members_submit', async ({ ack, view, body, client }) => {
    await ack();

    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const selectedMembers = view.state.values.members_input.members.selected_options || [];

      const usernames = selectedMembers.map((opt: any) => opt.value);

      // Remove each member
      for (const username of usernames) {
        removeTeamMember(channelId, username);
      }

      logger.info('Team members removed', { channelId, usernames });

      // Refresh App Home
      const config = getFullTeamConfig(channelId);
      await client.views.publish({
        user_id: userId,
        view: buildAppHomeView(channelId, config),
      });
    } catch (error: any) {
      logger.error('Error removing team members', { error: error.message });
    }
  });

  // Modal submission: Add repos
  app.view('add_repos_submit', async ({ ack, view, body, client }) => {
    await ack();

    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const reposText = view.state.values.repos_input.repos.value || '';

      // Parse repo names (one per line, trimmed)
      const repos = reposText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      // Ensure config exists
      upsertTeamConfig({ channel_id: channelId });

      // Add each repo
      for (const repo of repos) {
        addTeamRepo(channelId, repo);
      }

      logger.info('Team repos added', { channelId, repos });

      // Refresh App Home
      const config = getFullTeamConfig(channelId);
      await client.views.publish({
        user_id: userId,
        view: buildAppHomeView(channelId, config),
      });
    } catch (error: any) {
      logger.error('Error adding team repos', { error: error.message });
    }
  });

  // Modal submission: Remove repos
  app.view('remove_repos_submit', async ({ ack, view, body, client }) => {
    await ack();

    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const selectedRepos = view.state.values.repos_input.repos.selected_options || [];

      const repos = selectedRepos.map((opt: any) => opt.value);

      // Remove each repo
      for (const repo of repos) {
        removeTeamRepo(channelId, repo);
      }

      logger.info('Team repos removed', { channelId, repos });

      // Refresh App Home
      const config = getFullTeamConfig(channelId);
      await client.views.publish({
        user_id: userId,
        view: buildAppHomeView(channelId, config),
      });
    } catch (error: any) {
      logger.error('Error removing team repos', { error: error.message });
    }
  });

  // Modal submission: Update settings
  app.view('settings_submit', async ({ ack, view, body, client }) => {
    await ack();

    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;

      const values = view.state.values;

      const requiredApprovals = parseInt(values.approvals_input.approvals.value || '2', 10);
      const notifyOnOpen = (values.notify_open.notify_open_check.selected_options || []).length > 0;
      const notifyOnReady = (values.notify_ready.notify_ready_check.selected_options || []).length > 0;
      const notifyOnChanges = (values.notify_changes.notify_changes_check.selected_options || []).length > 0;
      const notifyOnApproved = (values.notify_approved.notify_approved_check.selected_options || []).length > 0;
      const notifyOnMerged = (values.notify_merged.notify_merged_check.selected_options || []).length > 0;

      upsertTeamConfig({
        channel_id: channelId,
        required_approvals: requiredApprovals,
        notify_on_open: notifyOnOpen ? 1 : 0,
        notify_on_ready: notifyOnReady ? 1 : 0,
        notify_on_changes_requested: notifyOnChanges ? 1 : 0,
        notify_on_approved: notifyOnApproved ? 1 : 0,
        notify_on_merged: notifyOnMerged ? 1 : 0,
      });

      logger.info('Team settings updated', { channelId, requiredApprovals });

      // Refresh App Home
      const config = getFullTeamConfig(channelId);
      await client.views.publish({
        user_id: userId,
        view: buildAppHomeView(channelId, config),
      });
    } catch (error: any) {
      logger.error('Error updating settings', { error: error.message });
    }
  });
}
