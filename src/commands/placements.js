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
  const limit = Math.min(Math.max(interaction.options.getInteger('limit') || 5, 1), 10);
  const game = interaction.options.getString('game');
  await interaction.deferReply();

  try {
    let query = supabase
      .from('placements')
      .select('id, game, tournament, team_name, position, prize, event_date')
      .order('event_date', { ascending: false })
      .limit(limit);

    if (game) {
      query = query.ilike('game', `%${game}%`);
    }

    const { data: placements, error } = await query;

    if (error) {
      console.error('placements error:', error);
      await interaction.editReply('Failed to fetch placements from database.');
      return;
    }

    if (!placements || !placements.length) {
      const filterMsg = game ? ` for game "${game}"` : '';
      await interaction.editReply(`No placements found${filterMsg}.`);
      return;
    }

    const embeds = placements.map(p => {
      const embed = new EmbedBuilder()
        .setTitle(`${p.tournament} – ${p.position}`)
        .addFields(
          { name: 'Team', value: p.team_name || 'N/A', inline: true },
          { name: 'Game', value: p.game || 'N/A', inline: true }
        )
        .setColor(0x1e90ff)
        .setTimestamp(p.event_date ? new Date(p.event_date) : undefined)
        .setFooter({ text: 'Void eSports Placements' });

      if (p.prize) {
        embed.addFields({ name: 'Prize', value: p.prize, inline: true });
      }

      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('placements unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching placements.');
  }
}

module.exports = {
  placementsCommand,
  handlePlacements
};

