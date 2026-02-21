const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List all commands and what they do.')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Filter by category')
      .setRequired(false)
      .addChoices(
        { name: '📊 Teams & Pros', value: 'teams' },
        { name: '🛒 Merch & Content', value: 'content' },
        { name: '🛠️ Utility', value: 'utility' },
        { name: '🛡️ Moderation', value: 'moderation' },
        { name: '🔗 Socials', value: 'socials' }
      )
  );

function buildHelpEmbed(category, totalCommands = 24) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Void Website Bot - Commands')
    .setDescription('All data is **live** from the Void website (Firebase). Use the buttons below to navigate.')
    .setColor(0x8a2be2)
    .setTimestamp()
    .setFooter({ 
      text: `${totalCommands} total commands • Use /help [category] to filter`,
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png'
    })
    .setThumbnail('https://media.discordapp.net/attachments/123456789/void-logo.png');

  if (category === 'teams') {
    embed.addFields(
      { name: '📊 **Team Statistics**', value: '`/teams` - Show all teams with pro/ops counts', inline: false },
      { name: '👥 **Pros**', value: '`/pros_list` - List all Fortnite pros (with pagination)\n`/pro_info` - Detailed pro profile by name', inline: true },
      { name: '👔 **Operations**', value: '`/ops_info` - List operations/management team', inline: true }
    );
  } else if (category === 'content') {
    embed.addFields(
      { name: '🛒 **Merch**', value: '`/merch` - Browse Void store merchandise', inline: true },
      { name: '📰 **News**', value: '`/news` - Latest news articles\n`/latest` - Single latest news', inline: true },
      { name: '🎥 **Videos**', value: '`/videos` - Latest YouTube videos\n`/latest-video` - Most recent video', inline: true },
      { name: '🏆 **Placements**', value: '`/placements` - Tournament placements\n`/top_placements` - Top 3 recent', inline: true },
      { name: '🎮 **Games**', value: '`/games` - All games with data\n`/random_pro` - Random Fortnite pro', inline: true }
    );
  } else if (category === 'utility') {
    embed.addFields(
      { name: '📊 **Stats**', value: '`/stats` - Website stats overview\n`/advanced_stats` - Detailed stats (admin only)', inline: true },
      { name: '🔌 **Status**', value: '`/status` - Connection status\n`/ping` - Latency check\n`/uptime` - Bot uptime', inline: true },
      { name: '❓ **Help**', value: '`/help` - This command', inline: true }
    );
  } else if (category === 'moderation') {
    embed.addFields(
      { name: '🛡️ **Moderation Commands**', value: '*(Require appropriate permissions)*', inline: false },
      { name: '👢 **Kick**', value: '`/kick` - Kick a member', inline: true },
      { name: '🔨 **Ban**', value: '`/ban` - Ban a member', inline: true },
      { name: '⏰ **Timeout**', value: '`/timeout` - Timeout a member', inline: true },
      { name: '⚠️ **Warn**', value: '`/warn` - Warn a member', inline: true },
      { name: '🧹 **Clear**', value: '`/clear` - Clear messages', inline: true }
    );
  } else if (category === 'socials') {
    embed.addFields(
      { name: '🔗 **Social Links**', value: '`/socials` - All Void social media platforms', inline: false },
      { name: '💬 **Discord**', value: 'Join our community!', inline: true },
      { name: '🎵 **TikTok**', value: '@voidesportsggs', inline: true },
      { name: '🎥 **YouTube**', value: '@voidesports2x', inline: true },
      { name: '🐦 **Twitter/X**', value: '@voidesports2x', inline: true },
      { name: '📸 **Instagram**', value: '@voidesports2x', inline: true }
    );
  } else {
    // Overview of all categories
    embed.addFields(
      { name: '📊 **Teams & Pros**', value: '`/teams` `/pros_list` `/pro_info` `/ops_info`', inline: false },
      { name: '🛒 **Merch & Content**', value: '`/merch` `/news` `/videos` `/placements` `/games` `/latest` `/top_placements` `/random_pro` `/latest-video`', inline: false },
      { name: '🛠️ **Utility**', value: '`/stats` `/advanced_stats` `/status` `/ping` `/uptime` `/help`', inline: false },
      { name: '🛡️ **Moderation**', value: '`/kick` `/ban` `/timeout` `/warn` `/clear`', inline: false },
      { name: '🔗 **Socials**', value: '`/socials`', inline: false }
    );
  }
  
  return embed;
}

function buildHelpButtons(currentCategory) {
  const rows = [];
  
  // First row - Category buttons (all use customId, no URLs)
  const categoryRow = new ActionRowBuilder();
  
  const categories = [
    { id: 'help_teams', label: '📊 Teams', emoji: '📊' },
    { id: 'help_content', label: '🛒 Content', emoji: '🛒' },
    { id: 'help_utility', label: '🛠️ Utility', emoji: '🛠️' },
    { id: 'help_moderation', label: '🛡️ Mod', emoji: '🛡️' },
    { id: 'help_socials', label: '🔗 Socials', emoji: '🔗' }
  ];
  
  categories.forEach(cat => {
    const button = new ButtonBuilder()
      .setCustomId(cat.id)
      .setLabel(cat.label)
      .setStyle(currentCategory === cat.id.replace('help_', '') ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji(cat.emoji);
    categoryRow.addComponents(button);
  });
  
  rows.push(categoryRow);
  
  // Second row - Utility buttons (separate customId and link buttons)
  const utilityRow = new ActionRowBuilder();
  
  // All Commands button (customId)
  utilityRow.addComponents(
    new ButtonBuilder()
      .setCustomId('help_all')
      .setLabel('📋 All Commands')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📋')
  );
  
  rows.push(utilityRow);
  
  // Third row - Link buttons only (these use URL, not customId)
  const linkRow = new ActionRowBuilder();
  
  // Support button (link)
  linkRow.addComponents(
    new ButtonBuilder()
      .setLabel('💬 Support Server')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/void-esports-lf-investors-1197180527686463498')
      .setEmoji('💬')
  );
  
  // Invite button (link)
  linkRow.addComponents(
    new ButtonBuilder()
      .setLabel('➕ Invite Bot')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands')
      .setEmoji('➕')
  );
  
  rows.push(linkRow);
  
  return rows;
}

async function handleHelp(interaction) {
  const category = interaction.options.getString('category') || null;
  const embed = buildHelpEmbed(category);
  const buttons = buildHelpButtons(category);
  
  await interaction.editReply({ 
    embeds: [embed], 
    components: buttons 
  });
}

async function handleHelpCategory(interaction, category) {
  const embed = buildHelpEmbed(category);
  const buttons = buildHelpButtons(category);
  
  await interaction.update({ 
    embeds: [embed], 
    components: buttons 
  });
}

module.exports = {
  helpCommand,
  handleHelp,
  handleHelpCategory
};
