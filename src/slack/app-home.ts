import { KnownBlock, Block, View } from '@slack/bolt';
import { TeamConfig } from '../types';

interface ChannelInfo {
  id: string;
  name: string;
}

/**
 * Build the App Home view for team configuration
 */
export function buildAppHomeView(
  channelId: string,
  config: TeamConfig | null,
  availableChannels: ChannelInfo[] = []
): View {
  const blocks: (KnownBlock | Block)[] = [];

  // Header
  blocks.push(
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚙️ PR Bot Configuration',
        emoji: true,
      },
    }
  );

  // Channel Selector (if multiple channels available)
  if (availableChannels.length > 0) {
    const currentChannel = availableChannels.find(ch => ch.id === channelId);
    const channelOptions = availableChannels.map(ch => ({
      text: {
        type: 'plain_text' as const,
        text: `#${ch.name}`,
        emoji: true,
      },
      value: ch.id,
    }));

    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📺 Configuring Channel:*\n${currentChannel ? `<#${channelId}>` : channelId}`,
        },
        accessory: {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select a channel',
            emoji: true,
          },
          options: channelOptions,
          initial_option: currentChannel ? {
            text: {
              type: 'plain_text' as const,
              text: `#${currentChannel.name}`,
              emoji: true,
            },
            value: currentChannel.id,
          } : undefined,
          action_id: 'select_channel',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_Select a channel to configure its PR notifications_',
          },
        ],
      },
      {
        type: 'divider',
      }
    );
  } else {
    // No channels available - show helper text
    blocks.push(
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Configure notifications for <#${channelId}>`,
          },
        ],
      },
      {
        type: 'divider',
      }
    );
  }

  // If no config exists, show setup message
  if (!config) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '👋 *Welcome to PR Bot!*\n\nTo get started, add GitHub team members you want to track.',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '➕ Add Team Members',
              emoji: true,
            },
            style: 'primary',
            action_id: 'open_add_members_modal',
            value: channelId,
          },
        ],
      }
    );
  } else {
    // Show current configuration

    // Team Members Section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*👥 GitHub Team Members*',
      },
    });

    if (config.members.length === 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_No team members added yet_',
          },
        ],
      });
    } else {
      // Show members with their Slack mappings if available
      const memberList = config.members.map(m => {
        if (typeof m === 'string') {
          return `• \`${m}\``;
        }
        // m is {github: string, slack?: string}
        const github = (m as any).github || m;
        const slack = (m as any).slack;
        return slack ? `• \`${github}\` → ${slack}` : `• \`${github}\``;
      }).join('\n');
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: memberList,
        },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '➕ Add Members',
            emoji: true,
          },
          action_id: 'open_add_members_modal',
          value: channelId,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '➖ Remove Members',
            emoji: true,
          },
          action_id: 'open_remove_members_modal',
          value: channelId,
        },
      ],
    });

    blocks.push({ type: 'divider' });

    // Repositories Section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📦 Tracked Repositories*',
      },
    });

    if (config.repos.length === 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_Tracking all repositories in the organization_',
          },
        ],
      });
    } else {
      const repoList = config.repos.map(r => `• \`${r}\``).join('\n');
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: repoList,
        },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '➕ Add Repos',
            emoji: true,
          },
          action_id: 'open_add_repos_modal',
          value: channelId,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '➖ Remove Repos',
            emoji: true,
          },
          action_id: 'open_remove_repos_modal',
          value: channelId,
        },
      ],
    });

    blocks.push({ type: 'divider' });

    // Settings Section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*⚙️ Notification Settings*',
      },
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Required Approvals:* ${config.requiredApprovals}\n\n*Notify when:*\n${config.notifyOnOpen ? '✅' : '❌'} PR opened\n${config.notifyOnReady ? '✅' : '❌'} PR ready for review\n${config.notifyOnChangesRequested ? '✅' : '❌'} Changes requested\n${config.notifyOnApproved ? '✅' : '❌'} PR approved\n${config.notifyOnMerged ? '✅' : '❌'} PR merged\n\n*Other Settings:*\n${config.excludeBotComments ? '✅' : '❌'} Exclude bot comments`,
      },
    });

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✏️ Edit Settings',
            emoji: true,
          },
          action_id: 'open_settings_modal',
          value: channelId,
        },
      ],
    });
  }

  return {
    type: 'home',
    blocks,
  };
}

/**
 * Modal for adding team members
 */
export function buildAddMembersModal(channelId: string): View {
  return {
    type: 'modal',
    callback_id: 'add_members_submit',
    private_metadata: channelId,
    title: {
      type: 'plain_text',
      text: 'Add Team Members',
    },
    submit: {
      type: 'plain_text',
      text: 'Add',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Add GitHub users with optional Slack @mentions*\n\n📝 Format: `github-username:SLACK_USER_ID` (one per line)\n\n💡 To get Slack User ID:\n1. Right-click on user in Slack\n2. View profile → Click ⋯ (More)\n3. Copy member ID (starts with U)',
        },
      },
      {
        type: 'input',
        block_id: 'members_input',
        element: {
          type: 'plain_text_input',
          action_id: 'members',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'github-username:U07V123ABCD',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Team Members (GitHub usernames)',
        },
        hint: {
          type: 'plain_text',
          text: 'Format: github-username or github-username:SLACK_USER_ID\n\nExamples:\n• john-doe\n• jane-smith:U07V123ABCD\n\nTo find Slack User ID: Right-click user in Slack → View profile → ⋯ → Copy member ID',
        },
      },
    ],
  };
}

/**
 * Modal for removing team members
 */
export function buildRemoveMembersModal(channelId: string, currentMembers: Array<{ github: string; slack?: string }>): View {
  const options = currentMembers.map(member => ({
    text: {
      type: 'plain_text' as const,
      text: member.slack ? `${member.github} → ${member.slack}` : member.github,
    },
    value: member.github,
  }));

  return {
    type: 'modal',
    callback_id: 'remove_members_submit',
    private_metadata: channelId,
    title: {
      type: 'plain_text',
      text: 'Remove Team Members',
    },
    submit: {
      type: 'plain_text',
      text: 'Remove',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'members_input',
        element: {
          type: 'multi_static_select',
          action_id: 'members',
          placeholder: {
            type: 'plain_text',
            text: 'Select members to remove',
          },
          options,
        },
        label: {
          type: 'plain_text',
          text: 'Team Members',
        },
      },
    ],
  };
}

/**
 * Modal for adding repositories
 */
export function buildAddReposModal(channelId: string): View {
  return {
    type: 'modal',
    callback_id: 'add_repos_submit',
    private_metadata: channelId,
    title: {
      type: 'plain_text',
      text: 'Add Repositories',
    },
    submit: {
      type: 'plain_text',
      text: 'Add',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'repos_input',
        element: {
          type: 'plain_text_input',
          action_id: 'repos',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'Enter repository names (one per line)',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Repository Names',
        },
        hint: {
          type: 'plain_text',
          text: 'Example:\napi-member\napi-patient-app\nui-admin',
        },
      },
    ],
  };
}

/**
 * Modal for removing repositories
 */
export function buildRemoveReposModal(channelId: string, currentRepos: string[]): View {
  const options = currentRepos.map(repo => ({
    text: {
      type: 'plain_text' as const,
      text: repo,
    },
    value: repo,
  }));

  return {
    type: 'modal',
    callback_id: 'remove_repos_submit',
    private_metadata: channelId,
    title: {
      type: 'plain_text',
      text: 'Remove Repositories',
    },
    submit: {
      type: 'plain_text',
      text: 'Remove',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'repos_input',
        element: {
          type: 'multi_static_select',
          action_id: 'repos',
          placeholder: {
            type: 'plain_text',
            text: 'Select repos to remove',
          },
          options,
        },
        label: {
          type: 'plain_text',
          text: 'Repositories',
        },
      },
    ],
  };
}

/**
 * Modal for editing settings
 */
export function buildSettingsModal(channelId: string, config: TeamConfig): View {
  return {
    type: 'modal',
    callback_id: 'settings_submit',
    private_metadata: channelId,
    title: {
      type: 'plain_text',
      text: 'Notification Settings',
    },
    submit: {
      type: 'plain_text',
      text: 'Save',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'input',
        block_id: 'approvals_input',
        element: {
          type: 'number_input',
          action_id: 'approvals',
          is_decimal_allowed: false,
          initial_value: String(config.requiredApprovals),
          min_value: '1',
          max_value: '10',
        },
        label: {
          type: 'plain_text',
          text: 'Required Approvals',
        },
      },
      {
        type: 'section',
        block_id: 'notify_open',
        text: {
          type: 'mrkdwn',
          text: '*Notify when PR opened*',
        },
        accessory: {
          type: 'checkboxes',
          action_id: 'notify_open_check',
          initial_options: config.notifyOnOpen
            ? [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }]
            : [],
          options: [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }],
        },
      },
      {
        type: 'section',
        block_id: 'notify_ready',
        text: {
          type: 'mrkdwn',
          text: '*Notify when PR ready for review*',
        },
        accessory: {
          type: 'checkboxes',
          action_id: 'notify_ready_check',
          initial_options: config.notifyOnReady
            ? [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }]
            : [],
          options: [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }],
        },
      },
      {
        type: 'section',
        block_id: 'notify_changes',
        text: {
          type: 'mrkdwn',
          text: '*Notify when changes requested*',
        },
        accessory: {
          type: 'checkboxes',
          action_id: 'notify_changes_check',
          initial_options: config.notifyOnChangesRequested
            ? [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }]
            : [],
          options: [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }],
        },
      },
      {
        type: 'section',
        block_id: 'notify_approved',
        text: {
          type: 'mrkdwn',
          text: '*Notify when PR approved*',
        },
        accessory: {
          type: 'checkboxes',
          action_id: 'notify_approved_check',
          initial_options: config.notifyOnApproved
            ? [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }]
            : [],
          options: [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }],
        },
      },
      {
        type: 'section',
        block_id: 'notify_merged',
        text: {
          type: 'mrkdwn',
          text: '*Notify when PR merged*',
        },
        accessory: {
          type: 'checkboxes',
          action_id: 'notify_merged_check',
          initial_options: config.notifyOnMerged
            ? [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }]
            : [],
          options: [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }],
        },
      },
      {
        type: 'section',
        block_id: 'exclude_bot_comments',
        text: {
          type: 'mrkdwn',
          text: '*Exclude bot comments from threads*',
        },
        accessory: {
          type: 'checkboxes',
          action_id: 'exclude_bot_comments_check',
          initial_options: config.excludeBotComments
            ? [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }]
            : [],
          options: [{ text: { type: 'plain_text', text: 'Enabled' }, value: 'enabled' }],
        },
      },
    ],
  };
}
