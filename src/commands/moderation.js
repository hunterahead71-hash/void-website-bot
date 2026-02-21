const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Kick Command
const kickCommand = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to kick')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for kick')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false);

// Ban Command
const banCommand = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to ban')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for ban')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('days')
      .setDescription('Delete messages from last X days (0-7)')
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

// Timeout Command
const timeoutCommand = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Timeout a member')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to timeout')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('duration')
      .setDescription('Timeout duration')
      .setRequired(true)
      .addChoices(
        { name: '60 seconds', value: '60' },
        { name: '5 minutes', value: '300' },
        { name: '10 minutes', value: '600' },
        { name: '1 hour', value: '3600' },
        { name: '6 hours', value: '21600' },
        { name: '12 hours', value: '43200' },
        { name: '1 day', value: '86400' },
        { name: '1 week', value: '604800' }
      ))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for timeout')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

// Warn Command
const warnCommand = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a member')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Member to warn')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for warning')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

// Clear Messages Command
const clearCommand = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear messages in the current channel')
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of messages to clear (1-100)')
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(true))
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Only clear messages from this user')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

// Warning storage (in-memory - in production use database)
const warnings = new Map();

// Helper function to create mod action embed
function createModEmbed(action, target, moderator, reason, duration = null, color = null) {
  const colors = {
    kick: 0xFFA500,
    ban: 0xFF0000,
    timeout: 0xFFFF00,
    warn: 0xFFD700,
    clear: 0x00FF00
  };
  
  const emojis = {
    kick: '👢',
    ban: '🔨',
    timeout: '⏰',
    warn: '⚠️',
    clear: '🧹'
  };
  
  const embed = new EmbedBuilder()
    .setColor(color || colors[action] || 0x8a2be2)
    .setTitle(`${emojis[action]} Member ${action.charAt(0).toUpperCase() + action.slice(1)}ed`)
    .setDescription(`**${action}** action performed by ${moderator}`)
    .addFields(
      { name: '👤 Target', value: `${target} (${target.id})`, inline: true },
      { name: '🛡️ Moderator', value: `${moderator}`, inline: true }
    )
    .setTimestamp()
    .setFooter({ 
      text: `Action ID: ${Date.now().toString(36)}`, 
      iconURL: moderator.user.displayAvatarURL() 
    });
  
  if (reason) {
    embed.addFields({ name: '📝 Reason', value: reason, inline: false });
  }
  
  if (duration) {
    embed.addFields({ name: '⏱️ Duration', value: duration, inline: true });
  }
  
  return embed;
}

// Handle Kick
async function handleKick(interaction) {
  const target = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  
  if (!member) {
    await interaction.editReply({ 
      content: '❌ That user is not in this server.',
      ephemeral: true 
    });
    return;
  }
  
  if (!member.kickable) {
    await interaction.editReply({ 
      content: '❌ I cannot kick this member. They may have higher permissions than me.',
      ephemeral: true 
    });
    return;
  }
  
  if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.member.id !== interaction.guild.ownerId) {
    await interaction.editReply({ 
      content: '❌ You cannot kick this member (role hierarchy).',
      ephemeral: true 
    });
    return;
  }
  
  // Create confirmation buttons
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_kick_${target.id}`)
        .setLabel('✅ Confirm Kick')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_mod_action')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const previewEmbed = createModEmbed('kick', target, interaction.member, reason, null, 0xFFA500);
  
  await interaction.editReply({ 
    content: `⚠️ **Are you sure you want to kick ${target.tag}?**`,
    embeds: [previewEmbed], 
    components: [row] 
  });
  
  // Wait for confirmation
  const filter = i => i.user.id === interaction.user.id;
  try {
    const confirmation = await interaction.channel.awaitMessageComponent({ filter, time: 30000 });
    
    if (confirmation.customId === `confirm_kick_${target.id}`) {
      await confirmation.update({ 
        content: `🔄 Kicking ${target.tag}...`, 
        components: [] 
      });
      
      await member.kick(reason);
      
      const successEmbed = createModEmbed('kick', target, interaction.member, reason, null, 0x00FF00);
      
      await confirmation.editReply({ 
        content: `✅ Successfully kicked ${target.tag}`,
        embeds: [successEmbed], 
        components: [] 
      });
      
      // Try to DM the user
      try {
        await target.send({ 
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFA500)
              .setTitle(`You were kicked from ${interaction.guild.name}`)
              .setDescription(`**Reason:** ${reason}`)
              .setTimestamp()
          ]
        });
      } catch (dmError) {
        console.log(`Could not DM ${target.tag} about kick`);
      }
      
    } else if (confirmation.customId === 'cancel_mod_action') {
      await confirmation.update({ 
        content: '❌ Kick cancelled.', 
        embeds: [], 
        components: [] 
      });
    }
  } catch (error) {
    await interaction.editReply({ 
      content: '❌ Kick timed out (no confirmation received).', 
      embeds: [], 
      components: [] 
    });
  }
}

// Handle Ban
async function handleBan(interaction) {
  const target = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const days = interaction.options.getInteger('days') || 0;
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  
  if (member && !member.bannable) {
    await interaction.editReply({ 
      content: '❌ I cannot ban this member. They may have higher permissions than me.',
      ephemeral: true 
    });
    return;
  }
  
  if (member && interaction.member.roles.highest.position <= member.roles.highest.position && interaction.member.id !== interaction.guild.ownerId) {
    await interaction.editReply({ 
      content: '❌ You cannot ban this member (role hierarchy).',
      ephemeral: true 
    });
    return;
  }
  
  // Create confirmation buttons with options
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_ban_${target.id}`)
        .setLabel('✅ Confirm Ban')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`confirm_ban_notify_${target.id}`)
        .setLabel('📨 Ban & Send DM')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('cancel_mod_action')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const previewEmbed = createModEmbed('ban', target, interaction.member, `${reason}\nMessage Deletion: Last ${days} days`, null, 0xFF0000);
  
  await interaction.editReply({ 
    content: `⚠️ **Are you sure you want to ban ${target.tag}?**\nThis will delete their messages from the last ${days} days.`,
    embeds: [previewEmbed], 
    components: [row] 
  });
  
  // Wait for confirmation
  const filter = i => i.user.id === interaction.user.id;
  try {
    const confirmation = await interaction.channel.awaitMessageComponent({ filter, time: 30000 });
    
    if (confirmation.customId.startsWith('confirm_ban')) {
      const sendDm = confirmation.customId.includes('notify');
      
      await confirmation.update({ 
        content: `🔄 Banning ${target.tag}...`, 
        components: [] 
      });
      
      // Try to DM if requested
      if (sendDm) {
        try {
          await target.send({ 
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(`You were banned from ${interaction.guild.name}`)
                .setDescription(`**Reason:** ${reason}\n**Message Deletion:** Last ${days} days`)
                .setTimestamp()
            ]
          });
        } catch (dmError) {
          console.log(`Could not DM ${target.tag} about ban`);
        }
      }
      
      await interaction.guild.members.ban(target.id, { reason, deleteMessageDays: days });
      
      const successEmbed = createModEmbed('ban', target, interaction.member, `${reason}${sendDm ? '\n(DM sent)' : ''}`, null, 0x00FF00);
      
      await confirmation.editReply({ 
        content: `✅ Successfully banned ${target.tag}`,
        embeds: [successEmbed], 
        components: [] 
      });
      
    } else if (confirmation.customId === 'cancel_mod_action') {
      await confirmation.update({ 
        content: '❌ Ban cancelled.', 
        embeds: [], 
        components: [] 
      });
    }
  } catch (error) {
    await interaction.editReply({ 
      content: '❌ Ban timed out (no confirmation received).', 
      embeds: [], 
      components: [] 
    });
  }
}

// Handle Timeout
async function handleTimeout(interaction) {
  const target = interaction.options.getUser('target');
  const durationSeconds = parseInt(interaction.options.getString('duration'), 10);
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  
  if (!member) {
    await interaction.editReply({ 
      content: '❌ That user is not in this server.',
      ephemeral: true 
    });
    return;
  }
  
  if (!member.moderatable) {
    await interaction.editReply({ 
      content: '❌ I cannot timeout this member. They may have higher permissions than me.',
      ephemeral: true 
    });
    return;
  }
  
  if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.member.id !== interaction.guild.ownerId) {
    await interaction.editReply({ 
      content: '❌ You cannot timeout this member (role hierarchy).',
      ephemeral: true 
    });
    return;
  }
  
  // Format duration for display
  const durationMs = durationSeconds * 1000;
  const durationDate = new Date(Date.now() + durationMs);
  const durationDisplay = formatDuration(durationSeconds);
  
  // Create confirmation with options
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_timeout_${target.id}`)
        .setLabel('✅ Confirm Timeout')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('cancel_mod_action')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const previewEmbed = createModEmbed('timeout', target, interaction.member, reason, durationDisplay, 0xFFFF00);
  
  await interaction.editReply({ 
    content: `⚠️ **Are you sure you want to timeout ${target.tag} for ${durationDisplay}?**`,
    embeds: [previewEmbed], 
    components: [row] 
  });
  
  // Wait for confirmation
  const filter = i => i.user.id === interaction.user.id;
  try {
    const confirmation = await interaction.channel.awaitMessageComponent({ filter, time: 30000 });
    
    if (confirmation.customId === `confirm_timeout_${target.id}`) {
      await confirmation.update({ 
        content: `🔄 Timing out ${target.tag}...`, 
        components: [] 
      });
      
      await member.timeout(durationMs, reason);
      
      const successEmbed = createModEmbed('timeout', target, interaction.member, reason, durationDisplay, 0x00FF00);
      successEmbed.addFields({ name: '⏰ Expires', value: `<t:${Math.floor(durationDate.getTime() / 1000)}:R>`, inline: true });
      
      await confirmation.editReply({ 
        content: `✅ Successfully timed out ${target.tag} for ${durationDisplay}`,
        embeds: [successEmbed], 
        components: [] 
      });
      
      // Try to DM the user
      try {
        await target.send({ 
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFFF00)
              .setTitle(`You were timed out in ${interaction.guild.name}`)
              .setDescription(`**Duration:** ${durationDisplay}\n**Reason:** ${reason}\n**Expires:** <t:${Math.floor(durationDate.getTime() / 1000)}:R>`)
              .setTimestamp()
          ]
        });
      } catch (dmError) {
        console.log(`Could not DM ${target.tag} about timeout`);
      }
      
    } else if (confirmation.customId === 'cancel_mod_action') {
      await confirmation.update({ 
        content: '❌ Timeout cancelled.', 
        embeds: [], 
        components: [] 
      });
    }
  } catch (error) {
    await interaction.editReply({ 
      content: '❌ Timeout timed out (no confirmation received).', 
      embeds: [], 
      components: [] 
    });
  }
}

// Handle Warn
async function handleWarn(interaction) {
  const target = interaction.options.getUser('target');
  const reason = interaction.options.getString('reason');
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  
  if (!member) {
    await interaction.editReply({ 
      content: '❌ That user is not in this server.',
      ephemeral: true 
    });
    return;
  }
  
  // Get or create warning history
  const userId = target.id;
  if (!warnings.has(userId)) {
    warnings.set(userId, []);
  }
  
  const userWarnings = warnings.get(userId);
  const warningId = userWarnings.length + 1;
  
  // Add warning
  const warning = {
    id: warningId,
    moderator: interaction.user.tag,
    moderatorId: interaction.user.id,
    reason,
    date: new Date().toISOString(),
    guildId: interaction.guild.id
  };
  
  userWarnings.push(warning);
  
  // Create warning embed
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('⚠️ Member Warned')
    .setDescription(`${target} has been warned`)
    .addFields(
      { name: '👤 Member', value: `${target.tag} (${target.id})`, inline: true },
      { name: '🛡️ Moderator', value: interaction.user.tag, inline: true },
      { name: '⚠️ Warning #', value: warningId.toString(), inline: true },
      { name: '📝 Reason', value: reason, inline: false },
      { name: '📊 Total Warnings', value: userWarnings.length.toString(), inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Warning ID: ${warningId}` });
  
  // Create action buttons
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`warnings_view_${target.id}`)
        .setLabel('📋 View All Warnings')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('📨 DM Warning')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(`dm_warning_${target.id}_${warningId}`)
    );
  
  await interaction.editReply({ 
    embeds: [embed], 
    components: [row] 
  });
  
  // Try to DM the user
  try {
    await target.send({ 
      embeds: [
        new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle(`⚠️ You have been warned in ${interaction.guild.name}`)
          .setDescription(`**Warning #${warningId}**`)
          .addFields(
            { name: '📝 Reason', value: reason },
            { name: '🛡️ Moderator', value: interaction.user.tag }
          )
          .setTimestamp()
      ]
    });
  } catch (dmError) {
    console.log(`Could not DM ${target.tag} about warning`);
  }
}

// Handle Clear Messages
async function handleClear(interaction) {
  const amount = interaction.options.getInteger('amount');
  const target = interaction.options.getUser('target');
  
  await interaction.editReply({ 
    content: `🧹 Clearing ${amount} message${amount > 1 ? 's' : ''}...`, 
    embeds: [], 
    components: [] 
  });
  
  try {
    let messages;
    const channel = interaction.channel;
    
    if (target) {
      // Fetch messages and filter by user
      const fetched = await channel.messages.fetch({ limit: 100 });
      messages = fetched.filter(msg => msg.author.id === target.id).first(amount);
    } else {
      messages = await channel.bulkDelete(amount, true);
    }
    
    if (target) {
      const deletedCount = 0;
      for (const msg of messages) {
        await msg.delete();
        deletedCount++;
      }
    }
    
    const deletedAmount = target ? messages.length : messages.size;
    
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🧹 Messages Cleared')
      .setDescription(`Successfully cleared **${deletedAmount}** message${deletedAmount > 1 ? 's' : ''}`)
      .addFields(
        { name: '📍 Channel', value: `<#${channel.id}>`, inline: true },
        { name: '👤 Target', value: target ? `${target.tag}` : 'All users', inline: true },
        { name: '🛡️ Moderator', value: interaction.user.tag, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Action ID: ${Date.now().toString(36)}` });
    
    await interaction.editReply({ 
      content: null, 
      embeds: [embed], 
      components: [] 
    });
    
    // Auto-delete the response after 5 seconds
    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, 5000);
    
  } catch (error) {
    console.error('Clear error:', error);
    await interaction.editReply({ 
      content: '❌ Failed to clear messages. Messages may be older than 14 days.',
      embeds: [], 
      components: [] 
    });
    
    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, 5000);
  }
}

// Handle View Warnings
async function handleViewWarnings(interaction, userId) {
  if (!warnings.has(userId)) {
    await interaction.update({ 
      content: '✅ This user has no warnings.', 
      embeds: [], 
      components: [] 
    });
    return;
  }
  
  const userWarnings = warnings.get(userId);
  const target = await interaction.client.users.fetch(userId).catch(() => null);
  
  if (!target) {
    await interaction.update({ 
      content: '❌ User not found.', 
      embeds: [], 
      components: [] 
    });
    return;
  }
  
  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`⚠️ Warning History for ${target.tag}`)
    .setDescription(`Total Warnings: **${userWarnings.length}**`)
    .setTimestamp();
  
  userWarnings.slice(-5).reverse().forEach((warning, index) => {
    embed.addFields({
      name: `Warning #${warning.id} - ${new Date(warning.date).toLocaleDateString()}`,
      value: `**Reason:** ${warning.reason}\n**Moderator:** ${warning.moderator}`,
      inline: false
    });
  });
  
  if (userWarnings.length > 5) {
    embed.setFooter({ text: `Showing 5 most recent of ${userWarnings.length} warnings` });
  }
  
  await interaction.update({ 
    embeds: [embed], 
    components: [] 
  });
}

// Helper function to format duration
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins} min ${secs} sec` : `${mins} minutes`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours} hour ${mins} min` : `${hours} hours`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? `${days} day ${hours} hour` : `${days} days`;
}

module.exports = {
  kickCommand,
  banCommand,
  timeoutCommand,
  warnCommand,
  clearCommand,
  handleKick,
  handleBan,
  handleTimeout,
  handleWarn,
  handleClear,
  handleViewWarnings
};
