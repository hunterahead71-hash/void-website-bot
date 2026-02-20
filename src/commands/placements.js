const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../supabaseClient');

const placementsCommand = new SlashCommandBuilder()
  .setName('placements')
  .setDescription('Show recent tournament placements.')
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('How many placements (1-10)')
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Filter by game')
      .setRequired(false)
  );

async function handlePlacements(interaction) {
  const limit = interaction.options.getInteger('limit') || 5;
  const game = interaction.options.getString('game');
  await interaction.deferReply();

  let query = supabase
    .from('placements')
    .select('id, game, tournament, team_name, position, prize, event_date')
    .order('event_date', { ascending: false })
    .limit(limit);

  if (game) {
    query = query.ilike('game', game);
  }

  const { data: placements, error } = await query;

  if (error || !placements) {
    console.error('placements error:', error);
    await interaction.editReply('Failed to fetch placements.');
    return;
  }

  if (!placements.length) {
    await interaction.editReply('No placements found for that filter.');
    return;
  }

  const embeds = placements.map(p => {
    const embed = new EmbedBuilder()
      .setTitle(`${p.tournament} – ${p.position}`)
      .addFields(
        { name: 'Team', value: p.team_name || 'N/A', inline: true },
        { name: 'Game', value: p.game || 'N/A', inline: true }
      )
      .setColor(0x1e90ff);

    if (p.prize) {
      embed.addFields({ name: 'Prize', value: p.prize, inline: true });
    }

    if (p.event_date) {
      embed.setFooter({ text: `Event date: ${new Date(p.event_date).toLocaleDateString()}` });
    }

    return embed;
  });

  await interaction.editReply({ embeds });
}

module.exports = {
  placementsCommand,
  handlePlacements
};

