'use strict';

const {
  buildAppHomeView,
  buildAddMembersModal,
  buildRemoveMembersModal,
  buildAddReposModal,
  buildRemoveReposModal,
  buildSettingsModal,
} = require('./app-home');
const {
  getFullTeamConfig,
  upsertTeamConfig,
  addTeamMember,
  removeTeamMember,
  addTeamRepo,
  removeTeamRepo,
  getUserSelectedChannel,
  setUserSelectedChannel,
} = require('../../database/team-config');
const { logger } = require('../../logger');

/**
 * @param {object} client
 * @returns {Promise<{ id: string, name: string }[]>}
 */
async function getBotChannels(client) {
  try {
    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
    });

    if (!result.ok || !result.channels) return [];

    return result.channels
      .filter(ch => ch.is_member)
      .map(ch => ({ id: ch.id, name: ch.name }));
  } catch (error) {
    logger.error('Error fetching bot channels', { error: error.message });
    return [];
  }
}

/**
 * @param {object} client
 * @param {string} userId
 * @param {string} channelId
 */
async function refreshAppHome(client, userId, channelId) {
  const availableChannels = await getBotChannels(client);
  const config = getFullTeamConfig(channelId);
  const view = buildAppHomeView(channelId, config, availableChannels);

  await client.views.publish({ user_id: userId, view });
}

/**
 * @param {import('@slack/bolt').App} app
 */
function registerAppHomeHandlers(app) {
  app.event('app_home_opened', async ({ event, client }) => {
    try {
      const userId = event.user;
      const availableChannels = await getBotChannels(client);

      let channelId = getUserSelectedChannel(userId);

      if (!channelId && availableChannels.length > 0) {
        channelId = availableChannels[0].id;
        setUserSelectedChannel(userId, channelId);
      } else if (!channelId) {
        channelId = userId;
      }

      const config = getFullTeamConfig(channelId);
      const view = buildAppHomeView(channelId, config, availableChannels);

      await client.views.publish({ user_id: userId, view });

      logger.info('App Home opened', { userId, channelId, availableChannels: availableChannels.length });
    } catch (error) {
      logger.error('Error publishing App Home', { error: error.message });
    }
  });

  app.action('select_channel', async ({ ack, body, client, action }) => {
    await ack();
    try {
      const userId = body.user.id;
      const selectedChannelId = action.selected_option.value;

      setUserSelectedChannel(userId, selectedChannelId);

      const availableChannels = await getBotChannels(client);
      const config = getFullTeamConfig(selectedChannelId);
      const view = buildAppHomeView(selectedChannelId, config, availableChannels);

      await client.views.publish({ user_id: userId, view });

      logger.info('Channel selected in App Home', { userId, channelId: selectedChannelId });
    } catch (error) {
      logger.error('Error handling channel selection', { error: error.message });
    }
  });

  app.action('open_add_members_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      const channelId = body.actions[0].value;
      await client.views.open({ trigger_id: body.trigger_id, view: buildAddMembersModal(channelId) });
    } catch (error) {
      logger.error('Error opening add members modal', { error: error.message });
    }
  });

  app.action('open_remove_members_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      const channelId = body.actions[0].value;
      const config = getFullTeamConfig(channelId);
      if (!config || config.members.length === 0) return;
      await client.views.open({ trigger_id: body.trigger_id, view: buildRemoveMembersModal(channelId, config.members) });
    } catch (error) {
      logger.error('Error opening remove members modal', { error: error.message });
    }
  });

  app.action('open_add_repos_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      const channelId = body.actions[0].value;
      await client.views.open({ trigger_id: body.trigger_id, view: buildAddReposModal(channelId) });
    } catch (error) {
      logger.error('Error opening add repos modal', { error: error.message });
    }
  });

  app.action('open_remove_repos_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      const channelId = body.actions[0].value;
      const config = getFullTeamConfig(channelId);
      if (!config || config.repos.length === 0) return;
      await client.views.open({ trigger_id: body.trigger_id, view: buildRemoveReposModal(channelId, config.repos) });
    } catch (error) {
      logger.error('Error opening remove repos modal', { error: error.message });
    }
  });

  app.action('open_settings_modal', async ({ ack, body, client }) => {
    await ack();
    try {
      const channelId = body.actions[0].value;
      let config = getFullTeamConfig(channelId);

      if (!config) {
        upsertTeamConfig({ channel_id: channelId });
        config = getFullTeamConfig(channelId);
        if (!config) return;
      }

      await client.views.open({ trigger_id: body.trigger_id, view: buildSettingsModal(channelId, config) });
    } catch (error) {
      logger.error('Error opening settings modal', { error: error.message });
    }
  });

  app.view('add_members_submit', async ({ ack, view, body, client }) => {
    await ack();
    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const membersText = view.state.values.members_input.members.value || '';

      const entries = membersText.split('\n').map(line => line.trim()).filter(Boolean);

      upsertTeamConfig({ channel_id: channelId });

      for (const entry of entries) {
        if (entry.includes(':')) {
          const [githubUsername, slackPart] = entry.split(':').map(s => s.trim());
          let slackUserId;
          if (slackPart.startsWith('<@') && slackPart.endsWith('>')) {
            slackUserId = slackPart.slice(2, -1);
          } else if (slackPart.startsWith('@')) {
            logger.warn('Slack username format not supported yet, use User ID or mention', { slackPart });
          } else if (slackPart.startsWith('U')) {
            slackUserId = slackPart;
          }
          addTeamMember(channelId, githubUsername, slackUserId, userId);
        } else {
          addTeamMember(channelId, entry, undefined, userId);
        }
      }

      logger.info('Team members added', { channelId, entries, addedBy: userId });
      await refreshAppHome(client, userId, channelId);
    } catch (error) {
      logger.error('Error adding team members', { error: error.message });
    }
  });

  app.view('remove_members_submit', async ({ ack, view, body, client }) => {
    await ack();
    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const selectedMembers = view.state.values.members_input.members.selected_options || [];
      const usernames = selectedMembers.map(opt => opt.value);

      for (const username of usernames) {
        removeTeamMember(channelId, username);
      }

      logger.info('Team members removed', { channelId, usernames });
      await refreshAppHome(client, userId, channelId);
    } catch (error) {
      logger.error('Error removing team members', { error: error.message });
    }
  });

  app.view('add_repos_submit', async ({ ack, view, body, client }) => {
    await ack();
    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const reposText = view.state.values.repos_input.repos.value || '';
      const repos = reposText.split('\n').map(line => line.trim()).filter(Boolean);

      upsertTeamConfig({ channel_id: channelId });

      for (const repo of repos) {
        addTeamRepo(channelId, repo);
      }

      logger.info('Team repos added', { channelId, repos });
      await refreshAppHome(client, userId, channelId);
    } catch (error) {
      logger.error('Error adding team repos', { error: error.message });
    }
  });

  app.view('remove_repos_submit', async ({ ack, view, body, client }) => {
    await ack();
    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const selectedRepos = view.state.values.repos_input.repos.selected_options || [];
      const repos = selectedRepos.map(opt => opt.value);

      for (const repo of repos) {
        removeTeamRepo(channelId, repo);
      }

      logger.info('Team repos removed', { channelId, repos });
      await refreshAppHome(client, userId, channelId);
    } catch (error) {
      logger.error('Error removing team repos', { error: error.message });
    }
  });

  app.view('settings_submit', async ({ ack, view, body, client }) => {
    await ack();
    try {
      const channelId = view.private_metadata;
      const userId = body.user.id;
      const values = view.state.values;

      const requiredApprovals = parseInt(values.approvals_input.approvals.value || '2', 10);
      const postTrigger = values.post_trigger_block?.post_trigger_radio?.selected_option?.value || 'on_open';
      const triggerLabel = values.trigger_label_block?.trigger_label_input?.value || null;
      const notifyOnReady = (values.notify_ready.notify_ready_check.selected_options || []).length > 0;
      const notifyOnChanges = (values.notify_changes.notify_changes_check.selected_options || []).length > 0;
      const notifyOnApproved = (values.notify_approved.notify_approved_check.selected_options || []).length > 0;
      const notifyOnMerged = (values.notify_merged.notify_merged_check.selected_options || []).length > 0;
      const excludeBotComments = (values.exclude_bot_comments.exclude_bot_comments_check.selected_options || []).length > 0;

      upsertTeamConfig({
        channel_id: channelId,
        required_approvals: requiredApprovals,
        post_trigger: postTrigger,
        trigger_label: triggerLabel,
        notify_on_ready: notifyOnReady ? 1 : 0,
        notify_on_changes_requested: notifyOnChanges ? 1 : 0,
        notify_on_approved: notifyOnApproved ? 1 : 0,
        notify_on_merged: notifyOnMerged ? 1 : 0,
        exclude_bot_comments: excludeBotComments ? 1 : 0,
      });

      logger.info('Team settings updated', { channelId, requiredApprovals });
      await refreshAppHome(client, userId, channelId);
    } catch (error) {
      logger.error('Error updating settings', { error: error.message });
    }
  });
}

module.exports = { registerAppHomeHandlers };
