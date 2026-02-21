const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const helpCommand = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List all commands and what they do.')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Filter by category')
      .setRequired(false)
      .addChoices(
        { name: 'Pros & Teams', value: 'pros' },
        { name: 'Merch & News', value: 'content' },
        { name: 'Utility & Advanced', value: 'utility' }
      )
  );

function buildHelpEmbed(category) {
  const embed = new EmbedBuilder()
    .setTitle('Void Website Bot - Commands')
    .setDescription('All data is **live** from the Void website (Firebase).')
    .setColor(0x8a2be2)
    .setTimestamp()
    .setFooter({ text: 'Use /help category:pros | content | utility to filter' });

  if (category === 'pros') {
    embed.addFields(
      { name: 'Pros & Teams', value: 'Live from website', inline: false },
      { name: '/pros_total', value: 'Total pros and teams', inline: true },
      { name: '/list_pros', value: 'Pros for a game (e.g. Fortnite)', inline: true },
      { name: '/pros_list', value: 'All pros, optional game filter', inline: true },
      { name: '/pro_info', value: 'Detailed pro by name', inline: true },
      { name: '/teams', value: 'List all teams', inline: true },
      { name: '/team_info', value: 'Team roster and details', inline: true }
    );
  } else if (category === 'content') {
    embed.addFields(
      { name: 'Merch & Content', value: 'Live from website', inline: false },
      { name: '/merch', value: 'Merch names and prices', inline: true },
      { name: '/news', value: 'Latest news', inline: true },
      { name: '/videos', value: 'Videos posted on the website', inline: true },
      { name: '/placements', value: 'Tournament placements (with pro names)', inline: true },
      { name: '/games', value: 'All games with data', inline: true },
      { name: '/latest', value: 'Single latest news', inline: true },
      { name: '/top_placements', value: 'Top 3 placements', inline: true },
      { name: '/random_pro', value: 'Random pro', inline: true },
      { name: '/mgmt_info', value: 'Management members and roles', inline: true }
    );
  } else if (category === 'utility') {
    embed.addFields(
      { name: 'Utility & Advanced', value: 'Admin-only where noted', inline: false },
      { name: '/stats', value: 'Website stats overview', inline: true },
      { name: '/advanced_stats', value: 'Detailed stats (admin role only)', inline: true },
      { name: '/status', value: 'Connection status', inline: true },
      { name: '/uptime', value: 'Bot uptime', inline: true },
      { name: '/ping', value: 'Latency', inline: true }
    );
  } else {
    embed.addFields(
      { name: 'Pros & Teams', value: '`/pros_total` `/list_pros` `/pros_list` `/pro_info` `/teams` `/team_info`', inline: false },
      { name: 'Merch & Content', value: '`/merch` `/news` `/videos` `/placements` `/games` `/latest` `/top_placements` `/random_pro` `/mgmt_info`', inline: false },
      { name: 'Utility', value: '`/stats` `/advanced_stats` (admin) `/status` `/uptime` `/ping`', inline: false }
    );
  }
  return embed;
}

async function handleHelp(interaction) {
  const category = interaction.options.getString('category') || null;
  const embed = buildHelpEmbed(category);
  await interaction.editReply({ embeds: [embed] });
}

module.exports = {
  helpCommand,
  handleHelp
};
